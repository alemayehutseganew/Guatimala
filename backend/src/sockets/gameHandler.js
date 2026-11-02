const db = require('../db')
const { validateBingo } = require('../utils/bingoValidator')
const { Server } = require('socket.io')
const { bot } = require('../bot/index')

const rooms = {}

function startCountdown(io, roomId) {
  const room = rooms[roomId]
  if (!room || room.status !== 'WAITING') return
  room.status = 'COUNTDOWN'
  console.log(`[Game] Starting countdown for ${roomId}`)

  let timeLeft = 5
  io.to(roomId).emit('countdown_tick', { timeLeft })

  const countdownInterval = setInterval(async () => {
    timeLeft -= 1
    io.to(roomId).emit('countdown_tick', { timeLeft })

    if (timeLeft <= 0) {
      clearInterval(countdownInterval)
      try {
        const participants = await db('room_participants').where({ room_id: roomId })
        const validPlayers = []

        for (const participant of participants) {
          const user = await db('users').where({ id: participant.user_id }).first()
          if (user && Number(user.wallet_balance) >= room.stake) {
            validPlayers.push({ participant, user })
          } else {
            const playerSocketId = Object.keys(room.players).find((id) => (
              String(room.players[id].userId) === String(participant.user_id)
            ))

            if (playerSocketId) {
              io.to(playerSocketId).emit('insufficient_funds', {
                message: 'You do not have enough balance to play this game. Please deposit funds.'
              })
              io.in(playerSocketId).socketsLeave(roomId)
              const kickedUserId = room.players[playerSocketId].userId
              delete room.players[playerSocketId]
              for (const readyUserId of room.readyPlayers) {
                if (String(readyUserId) === String(kickedUserId)) {
                  room.readyPlayers.delete(readyUserId)
                }
              }
            }

            await db('room_participants')
              .where({ room_id: roomId, user_id: participant.user_id })
              .del()
            await db('room_card_selections')
              .where({ room_id: roomId, user_id: participant.user_id })
              .del()
          }
        }

        if (validPlayers.length < 2) {
          room.status = 'WAITING'
          room.readyPlayers.clear()
          io.to(roomId).emit('countdown_tick', { timeLeft: null })
          io.to(roomId).emit('game_aborted', {
            message: 'Not enough players with sufficient balance. Game cancelled.'
          })
          return
        }

        await db.transaction(async (trx) => {
          for (const validPlayer of validPlayers) {
            await trx('users').where({ id: validPlayer.user.id }).decrement('wallet_balance', room.stake)
            await trx('financial_ledger').insert({
              user_id: validPlayer.user.id,
              amount: -room.stake,
              type: 'ENTRY_FEE'
            })
          }
        })

        room.status = 'PLAYING'
        io.to(roomId).emit('game_started')
        console.log(`[Game] All valid players paid. Starting game for room ${roomId}`)

        if (room.intervalId) clearInterval(room.intervalId)

        room.intervalId = setInterval(() => {
          if (room.status !== 'PLAYING') {
            clearInterval(room.intervalId)
            room.intervalId = null
            return
          }

          let number
          do {
            number = Math.floor(Math.random() * 75) + 1
          } while (room.calledNumbers.has(number))

          room.calledNumbers.add(number)

          let letter = 'B'
          if (number > 15) letter = 'I'
          if (number > 30) letter = 'N'
          if (number > 45) letter = 'G'
          if (number > 60) letter = 'O'

          room.latestNumber = { number, letter }
          console.log(`[Game] Calling number: ${letter} ${number}`)
          io.to(roomId).emit('new_number_called', { number, letter })

          if (room.calledNumbers.size === 75) {
            clearInterval(room.intervalId)
            room.intervalId = null
            room.status = 'ENDED'
          }
        }, 3000)
      } catch (err) {
        console.error('[Game] Error during countdown end:', err)
        room.status = 'WAITING'
        room.readyPlayers.clear()
        io.to(roomId).emit('countdown_tick', { timeLeft: null })
        io.to(roomId).emit('game_aborted', { message: 'Server error. Game cancelled.' })
      }
    }
  }, 1000)
}

function initGameHandler(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId, userId, stake }) => {
      try {
        let user = null
        if (userId) {
          user = await db('users').where({ id: userId }).first()
          if (!user) user = await db('users').where({ telegram_id: userId }).first()
        }
        if (!user) return socket.emit('error', { message: 'User not found' })

        // 1. SPECTATOR CHECK
        if (rooms[roomId] && (rooms[roomId].status === 'PLAYING' || rooms[roomId].status === 'COUNTDOWN')) {
          const participant = await db('room_participants').where({ room_id: roomId, user_id: user.id }).first()
          if (!participant) {
            socket.emit('game_in_progress', {
              message: 'A game is in progress. Please wait for the next round.',
              currentBall: rooms[roomId].latestNumber || null,
              calledNumbers: Array.from(rooms[roomId].calledNumbers)
            })
            return
          }
        }

        // 2. ADD PLAYER
        if (!rooms[roomId]) {
          rooms[roomId] = {
            id: roomId,
            stake: Number(stake) || 10,
            status: 'WAITING',
            players: {},
            calledNumbers: new Set(),
            latestNumber: null,
            intervalId: null
          }
        }

        rooms[roomId].players[socket.id] = { socketId: socket.id, userId: user.id }
        socket.join(roomId)

        const playerCount = Object.keys(rooms[roomId].players).length
        console.log(`[Game] Player ${user.id} joined. Total players: ${playerCount}`)

        io.to(roomId).emit('room_update', { players: playerCount, stake: rooms[roomId].stake })

        // 3. AUTO-START
        if (rooms[roomId].status === 'WAITING' && playerCount >= 2) {
          rooms[roomId].status = 'COUNTDOWN'
          let timeLeft = 5
          io.to(roomId).emit('countdown_tick', { timeLeft })
          
          const countdownInterval = setInterval(async () => {
            timeLeft -= 1
            io.to(roomId).emit('countdown_tick', { timeLeft })
            
            if (timeLeft <= 0) {
              clearInterval(countdownInterval)
              
              try {
                const paymentResult = await db.transaction(async (trx) => {
                  const participants = await trx('room_participants')
                    .where({ room_id: roomId })
                    .forUpdate()

                  if (participants.length < 2) {
                    return { error: 'NOT_ENOUGH_PLAYERS' }
                  }

                  for (const participant of participants) {
                    const user = await trx('users')
                      .where({ id: participant.user_id })
                      .forUpdate()
                      .first()

                    if (!user || Number(user.wallet_balance) < rooms[roomId].stake) {
                      return { insufficientUserId: participant.user_id }
                    }
                  }

                  for (const participant of participants) {
                    await trx('users')
                      .where({ id: participant.user_id })
                      .decrement('wallet_balance', rooms[roomId].stake)
                    await trx('financial_ledger').insert({
                      user_id: participant.user_id,
                      amount: -rooms[roomId].stake,
                      type: 'ENTRY_FEE'
                    })
                  }

                  return { success: true }
                })

                if (!paymentResult.success) {
                  if (paymentResult.insufficientUserId) {
                    const playerSocketId = Object.keys(rooms[roomId].players).find((id) => (
                      String(rooms[roomId].players[id].userId) === String(paymentResult.insufficientUserId)
                    ))
                    if (playerSocketId) {
                      io.to(playerSocketId).emit('insufficient_funds', {
                        message: 'Insufficient balance. Please deposit funds.'
                      })
                      io.in(playerSocketId).socketsLeave(roomId)
                      delete rooms[roomId].players[playerSocketId]
                    }
                    await db('room_participants')
                      .where({ room_id: roomId, user_id: paymentResult.insufficientUserId })
                      .del()
                    await db('room_card_selections')
                      .where({ room_id: roomId, user_id: paymentResult.insufficientUserId })
                      .del()
                  }

                  rooms[roomId].status = 'WAITING'
                  const message = paymentResult.error === 'NOT_ENOUGH_PLAYERS'
                    ? 'Not enough players. Game cancelled.'
                    : 'A player has insufficient funds. Game cancelled.'
                  io.to(roomId).emit('game_aborted', { message })
                  return
                }

                rooms[roomId].status = 'PLAYING'
                io.to(roomId).emit('game_started')

                if (rooms[roomId].intervalId) clearInterval(rooms[roomId].intervalId)
                rooms[roomId].intervalId = setInterval(() => {
                  if (rooms[roomId].status !== 'PLAYING') {
                    clearInterval(rooms[roomId].intervalId)
                    return
                  }
                  let num
                  do { num = Math.floor(Math.random() * 75) + 1 } while (rooms[roomId].calledNumbers.has(num))
                  rooms[roomId].calledNumbers.add(num)
                  
                  let letter = 'B'
                  if (num > 15) letter = 'I'
                  if (num > 30) letter = 'N'
                  if (num > 45) letter = 'G'
                  if (num > 60) letter = 'O'
                  
                  rooms[roomId].latestNumber = { number: num, letter }
                  io.to(roomId).emit('new_number_called', { number: num, letter })
                  
                  if (rooms[roomId].calledNumbers.size === 75) {
                    clearInterval(rooms[roomId].intervalId)
                    rooms[roomId].status = 'ENDED'
                    io.to(roomId).emit('game_ended_for_spectators')
                  }
                }, 3000)

              } catch (err) {
                console.error('[Game] Error during start:', err)
                rooms[roomId].status = 'WAITING'
                io.to(roomId).emit('game_aborted', { message: 'Server error. Game cancelled.' })
              }
            }
          }, 1000)
        }
      } catch (err) {
        console.error('[Game] Join room error:', err)
        socket.emit('error', { message: 'Server error' })
      }
    })
    socket.on('join_as_spectator', async ({ roomId, userId }) => {
      try {
        const room = rooms[roomId]
        if (!room) return

        socket.join(roomId)
        console.log(`[Spectator] User ${userId} is watching room ${roomId}`)

        socket.emit('spectator_sync', {
          calledNumbers: Array.from(room.calledNumbers),
          currentBall: room.latestNumber || null,
          status: room.status
        })
      } catch (err) {
        console.error('Spectator join error:', err)
      }
    })
    socket.on('leave_room', async ({ roomId, userId }) => {
  try {
    const room = rooms[roomId]
    
    // Only refund if the game hasn't started
    if (room && (room.status === 'WAITING' || room.status === 'COUNTDOWN')) {
      let user = null
      if (userId) {
        user = await db('users').where({ id: userId }).first()
        if (!user) user = await db('users').where({ telegram_id: userId }).first()
      }

      if (user) {
        const participant = await db('room_participants').where({ room_id: roomId, user_id: user.id }).first()
        
        if (participant) {
          await db.transaction(async (trx) => {
            await trx('room_participants').where({ room_id: roomId, user_id: user.id }).del()
            await trx('room_card_selections').where({ room_id: roomId, user_id: user.id }).del()
          })
          console.log(`[Game] Removed unpaid participant ${user.id} from room ${roomId}.`)
        }
      }
    }
    
    // Clean up memory
    if (room && room.players && room.players[socket.id]) {
      delete room.players[socket.id]
      if (room.readyPlayers) room.readyPlayers.delete(socket.id)
      
      io.to(roomId).emit('room_update', {
        players: Object.keys(room.players).length,
        readyPlayers: room.readyPlayers ? room.readyPlayers.size : 0
      })
    }
    socket.leave(roomId)
  } catch (err) {
    console.error('[Game] leave_room error:', err)
  }
})
    socket.on('claim_bingo', async ({ roomId, userId, cardId }) => {
  const room = rooms[roomId];
  if (!room) return;

  console.log(`[Claim] Received claim from user ${userId} for card ${cardId}. Status: ${room.status}`);

  // 1. Prevent claiming if game is not playing or is already ending
  if (room.status !== 'PLAYING') {
    return socket.emit('bingo_result', { success: false, message: 'The game is not currently active.' });
  }

  // 2. Prevent the same user from claiming twice
  if (!room.claimedBy) room.claimedBy = [];
  if (!Array.isArray(room.claimedBy)) room.claimedBy = [];
  if (room.claimedBy.includes(userId)) {
    return socket.emit('bingo_result', { success: false, message: 'You have already claimed Bingo!' });
  }

  try {
    // 3. Fetch the user's card from the database
    let user = await db('users').where({ id: userId }).first();
    if (!user) user = await db('users').where({ telegram_id: userId }).first();
    const selection = await db('room_card_selections').where({ room_id: roomId, user_id: user.id, card_id: cardId }).first();
    
    if (!selection) {
      return socket.emit('bingo_result', { success: false, message: 'Card not found.' });
    }

    const cardMatrix = typeof selection.card === 'string' ? JSON.parse(selection.card) : selection.card;

    // 4. SECURITY FIX: Validate against SERVER called numbers, NOT the client's markedNumbers
    const calledSet = new Set(Array.from(room.calledNumbers));
    const result = validateBingo(cardMatrix, calledSet);

    if (!result.isValid) {
      console.log(`[Claim] Invalid Bingo for user ${userId}. Reason: Not a valid pattern.`);
      return socket.emit('bingo_result', { success: false, message: 'Not a valid Bingo. Keep playing!' });
    }

    // 5. Valid Bingo! Lock the room
    room.claimedBy.push(userId);
    room.status = 'CLAIMING';
    
    // Stop calling numbers
    if (room.intervalId) {
      clearInterval(room.intervalId);
      room.intervalId = null;
    }

    console.log(`[Claim] Valid Bingo by user ${userId}. Starting 3-second window.`);
    
    // 6. Start the 3-second claim window (allows others to tie)
    setTimeout(async () => {
      try {
        console.log(`[Claim] Window closed. Processing payouts for room ${roomId}...`);
        
        let winnerName = 'A Player';
        const winnerCount = room.claimedBy.length;
        const participants = await db('room_participants').where({ room_id: roomId });
        const totalPlayers = participants.length;
        
        if (totalPlayers === 0) throw new Error('No players in room');
        const totalPool = room.stake * totalPlayers;
        const platformFee = totalPool * 0.15;
        const netWinnerPool = totalPool - platformFee;
        const payoutPerWinner = Math.floor((netWinnerPool / winnerCount) * 100) / 100;

        console.log(`[PAYOUT] Pool: ${totalPool}, Fee: ${platformFee}, Payout: ${payoutPerWinner}`);

        // Process payouts in DB
        await db.transaction(async (trx) => {
          for (const winnerId of room.claimedBy) {
            let winnerUser = await trx('users').where({ id: winnerId }).first();
            if (!winnerUser) winnerUser = await trx('users').where({ telegram_id: winnerId }).first();
            if (!winnerUser) continue;
            if (winnerName === 'A Player') winnerName = winnerUser.first_name || winnerUser.username || 'A Player';

            await trx('users').where({ id: winnerUser.id }).increment('wallet_balance', payoutPerWinner);
            await trx('financial_ledger').insert({
              user_id: winnerUser.id,
              amount: payoutPerWinner,
              type: 'WINNING_PAYOUT'
            });
            console.log(`[PAYOUT] Credited ${payoutPerWinner} to winner ${winnerUser.id}`);
          }
        });

        // Emit game over to everyone
        room.status = 'ENDED';
        io.to(roomId).emit('game_over', { 
          winnerIds: room.claimedBy, 
          payout: payoutPerWinner,
          winnerName: winnerName
        });
        io.to(roomId).emit('game_ended_for_spectators');

        // Reset room after 5 seconds
        setTimeout(() => {
          if (rooms[roomId]) {
            rooms[roomId].status = 'WAITING';
            rooms[roomId].claimedBy = [];
            rooms[roomId].calledNumbers = new Set();
            rooms[roomId].players = {};
          }
        }, 5000);

      } catch (err) {
        console.error('[Claim] Payout Error:', err);
        room.status = 'ENDED';
        io.to(roomId).emit('game_over', { winnerIds: room.claimedBy, payout: 0, winnerName: 'Error' });
        io.to(roomId).emit('game_ended_for_spectators');
      }
    }, 3000);

  } catch (err) {
    console.error('[Claim] Validation Error:', err);
    socket.emit('bingo_result', { success: false, message: 'Server error during validation.' });
  }
});

    socket.on('get_my_cards', async ({ roomId, userId } = {}) => {
      try {
        let uid = userId
        if (uid) {
          const u = await db('users').where({ id: uid }).first()
          if (!u) {
            const u2 = await db('users').where({ telegram_id: uid }).first()
            if (u2) uid = u2.id
          }
        }
        const selections = await db('room_card_selections').where({ room_id: roomId, user_id: uid })
        const cards = selections.map((sel) => ({
          id: sel.card_id,
          matrix: typeof sel.card === 'string' ? JSON.parse(sel.card) : sel.card,
        }))
        socket.emit('my_cards', { cards })
      } catch (err) {
        console.error('get_my_cards error:', err)
      }
    })

    socket.on('disconnect', async () => {
  try {
    // Loop through all rooms to find which one this socket was in
    for (const roomId in rooms) {
      const room = rooms[roomId]
      
      // If this socket is in the room's player list
      if (room.players && room.players[socket.id]) {
        const playerData = room.players[socket.id]
        const userId = playerData.userId
        
        // Only refund if the game hasn't started
        if (room.status === 'WAITING' || room.status === 'COUNTDOWN') {
          if (userId) {
            const participant = await db('room_participants').where({ room_id: roomId, user_id: userId }).first()
            
            if (participant) {
              await db.transaction(async (trx) => {
                await trx('room_participants').where({ room_id: roomId, user_id: userId }).del()
                await trx('room_card_selections').where({ room_id: roomId, user_id: userId }).del()
              })
              console.log(`[Game] Removed unpaid participant ${userId} from room ${roomId} after disconnect.`)
            }
          }
        }
        
        // Clean up memory
        delete room.players[socket.id]
        if (room.readyPlayers) room.readyPlayers.delete(userId)
        
        io.to(roomId).emit('room_update', {
          players: Object.keys(room.players).length,
          readyPlayers: room.readyPlayers ? room.readyPlayers.size : 0
        })
      }
    }
  } catch (err) {
    console.error('[Game] disconnect error:', err)
  }
})
  })
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  })
  initGameHandler(io)
  return io
}

module.exports = { initGameHandler, setupSocket, rooms }

