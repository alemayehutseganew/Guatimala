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

  const countdownInterval = setInterval(() => {
    timeLeft -= 1
    io.to(roomId).emit('countdown_tick', { timeLeft })

    if (timeLeft <= 0) {
      clearInterval(countdownInterval)
      room.status = 'PLAYING'
      io.to(roomId).emit('game_started')
      console.log(`[Game] Game started for ${roomId}`)

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

        console.log(`[Game] Calling number: ${letter} ${number}`)
        io.to(roomId).emit('new_number_called', { number, letter })

        if (room.calledNumbers.size === 75) {
          clearInterval(room.intervalId)
          room.intervalId = null
          room.status = 'ENDED'
        }
      }, 3000)
    }
  }, 1000)
}

function initGameHandler(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId, userId, stake }) => {
      try {
        console.log(`[Game] join_room received: roomId=${roomId}, userId=${userId}`)

        let user = null
        if (userId) {
          user = await db('users').where({ id: userId }).first()
          if (!user) user = await db('users').where({ telegram_id: userId }).first()
        }
        if (!user) {
          user = { id: userId || socket.id, first_name: 'Player' }
        }

        // CHECK IF GAME IS ALREADY IN PROGRESS
        const dbRoom = await db('game_rooms').where({ id: roomId }).first()
        if (dbRoom && (dbRoom.status === 'PLAYING' || dbRoom.status === 'COUNTDOWN')) {
          const participant = await db('room_participants').where({ room_id: roomId, user_id: user.id }).first()
          if (!participant) {
            console.log(`[Game] User ${user.id} tried to join in-progress game ${roomId}`)
            return socket.emit('game_in_progress', {
              message: 'A game is currently in progress. Please wait for the next round.'
            })
          }
        }

        if (userId) {
          const participant = await db('room_participants')
            .where({ room_id: roomId, user_id: user.id })
            .first()
          if (!participant) {
            console.log(`[SECURITY] User ${user.id} tried to join room ${roomId} without paying`)
            return socket.emit('error', {
              message: 'You have not paid to join this room. Please go back to the lobby.'
            })
          }
        }

        if (!rooms[roomId]) {
          rooms[roomId] = {
            id: roomId,
            stake: Number(stake) || 10,
            status: 'WAITING',
            players: {},
            readyPlayers: new Set(),
            calledNumbers: new Set(),
            latestNumber: null,
            intervalId: null
          }
        }

        rooms[roomId].players[socket.id] = { socketId: socket.id, userId: user.id }
        socket.join(roomId)

        const playerCount = Object.keys(rooms[roomId].players).length
        console.log(`[Game] Total players in ${roomId}: ${playerCount}`)

        const ticketRow = await db('room_card_selections').where({ room_id: roomId }).count('* as c').first()
        const ticketCount = Number(ticketRow ? ticketRow.c : 0)

        io.to(roomId).emit('room_update', {
          players: playerCount,
          tickets: ticketCount,
          readyPlayers: rooms[roomId].readyPlayers.size,
          stake: rooms[roomId].stake
        })
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
    socket.on('player_ready', async ({ roomId, userId }) => {
      try {
        if (!rooms[roomId]) return

        // Only allow ready clicks while the room is WAITING
        if (rooms[roomId].status !== 'WAITING') {
          return socket.emit('error', { message: 'The game is not in the waiting state.' })
        }

        if (!rooms[roomId].readyPlayers) {
          rooms[roomId].readyPlayers = new Set()
        }

        rooms[roomId].readyPlayers.add(userId)

        const readyCount = rooms[roomId].readyPlayers.size
        const playerCount = Object.keys(rooms[roomId].players).length

        const ticketRow = await db('room_card_selections').where({ room_id: roomId }).count('* as c').first()
        const ticketCount = Number(ticketRow ? ticketRow.c : 0)

        console.log(`[Game] Player ${userId} is ready. ${readyCount}/${playerCount} ready.`)

        io.to(roomId).emit('room_update', {
          players: playerCount,
          tickets: ticketCount,
          readyPlayers: readyCount,
          stake: rooms[roomId].stake
        })

        if (readyCount >= 2 && playerCount >= 2 && rooms[roomId].status === 'WAITING') {
          console.log(`[Game] Starting countdown for room ${roomId}`)
          rooms[roomId].status = 'COUNTDOWN'

          let timeLeft = 5
          io.to(roomId).emit('countdown_tick', { timeLeft })

          const countdownInterval = setInterval(() => {
            timeLeft -= 1
            io.to(roomId).emit('countdown_tick', { timeLeft })

            if (timeLeft <= 0) {
              clearInterval(countdownInterval)
              rooms[roomId].status = 'PLAYING'
              io.to(roomId).emit('game_started')
              console.log(`[Game] Game started for ${roomId}`)

              if (rooms[roomId].intervalId) clearInterval(rooms[roomId].intervalId)

              rooms[roomId].intervalId = setInterval(() => {
                if (rooms[roomId].status !== 'PLAYING') {
                  clearInterval(rooms[roomId].intervalId)
                  rooms[roomId].intervalId = null
                  return
                }

                let number
                do {
                  number = Math.floor(Math.random() * 75) + 1
                } while (rooms[roomId].calledNumbers.has(number))

                rooms[roomId].calledNumbers.add(number)

                let letter = 'B'
                if (number > 15) letter = 'I'
                if (number > 30) letter = 'N'
                if (number > 45) letter = 'G'
                if (number > 60) letter = 'O'

                rooms[roomId].latestNumber = { number, letter }

                console.log(`[Game] Calling number: ${letter} ${number}`)
                io.to(roomId).emit('new_number_called', { number, letter })

                if (rooms[roomId].calledNumbers.size === 75) {
                  clearInterval(rooms[roomId].intervalId)
                  rooms[roomId].intervalId = null
                  rooms[roomId].status = 'ENDED'
                }
              }, 3000)
            }
          }, 1000)
        }
      } catch (err) {
        console.error('[Game] Error in player_ready:', err)
      }
    })

    socket.on('leave_room', async ({ roomId, userId }) => {
      try {
        const room = rooms[roomId]
        if (room && (room.status === 'WAITING' || room.status === 'COUNTDOWN')) {
          let user = null
          if (userId) {
            user = await db('users').where({ id: userId }).first()
            if (!user) user = await db('users').where({ telegram_id: userId }).first()
          }
          if (user) {
            const stake = room.stake
            await db.transaction(async (trx) => {
              await trx('users').where({ id: user.id }).increment('wallet_balance', stake)
              await trx('financial_ledger').insert({
                user_id: user.id,
                amount: stake,
                type: 'REFUND',
                reference: `ROOM_${roomId}`,
                created_at: new Date(),
              })
              await trx('room_participants').where({ room_id: roomId, user_id: user.id }).del()
            })
          }
        }
        if (room && room.players[socket.id]) {
          delete room.players[socket.id]
          if (room.readyPlayers) room.readyPlayers.delete(socket.id)
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
        
        const winnerCount = room.claimedBy.length;
        const stake = room.stake;
        const playerCount = Object.keys(room.players).length;
        
        let winnerName = 'A Player';
        const winnerCount = room.claimedBy.length;
        const totalPlayers = Object.keys(room.players).length;
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

        // Reset room after 5 seconds
        setTimeout(() => {
          room.status = 'WAITING';
          room.claimedBy = [];
          room.calledNumbers = new Set();
          room.players = {};
        }, 5000);

      } catch (err) {
        console.error('[Claim] Payout Error:', err);
        room.status = 'ENDED';
        io.to(roomId).emit('game_over', { winnerIds: room.claimedBy, payout: 0, winnerName: 'Error' });
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

    socket.on('disconnect', () => {
      for (const roomId in rooms) {
        const room = rooms[roomId]
        if (room.players[socket.id]) {
          delete room.players[socket.id]
          if (room.readyPlayers) room.readyPlayers.delete(socket.id)
          const pc = Object.keys(room.players).length
          io.to(roomId).emit('room_update', { playerCount: pc, players: pc, readyPlayers: room.readyPlayers ? room.readyPlayers.size : 0 })
        }
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

