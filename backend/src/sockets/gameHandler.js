const db = require('../db')
const { validateBingo } = require('../utils/bingoValidator')
const { Server } = require('socket.io')
const { bot } = require('../bot/index')

const rooms = {}

function initGameHandler(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', async ({ roomId, userId, stake }) => {
  console.log(`[Game] join_room received: roomId=${roomId}, userId=${userId}`)

      try {
        let user = null
        if (userId) {
          user = await db('users').where({ id: userId }).first()
          if (!user) user = await db('users').where({ telegram_id: userId }).first()
        }
        if (!user) {
          user = { id: userId || socket.id, first_name: 'Player' }
        }

        // SECURITY CHECK: Verify the user has PAID to join this room
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
            calledNumbers: new Set(),
            intervalId: null
          }
        }

        rooms[roomId].players[socket.id] = { socketId: socket.id, userId: user.id }
        socket.join(roomId)

        const playerCount = Object.keys(rooms[roomId].players).length
        console.log(`[Game] Total players in ${roomId}: ${playerCount}`)

        io.to(roomId).emit('room_update', { players: playerCount, stake: rooms[roomId].stake })

        if (playerCount >= 2 && rooms[roomId].status === 'WAITING') {
          rooms[roomId].status = 'COUNTDOWN'
          console.log(`[Game] Starting countdown for ${roomId}`)

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
        console.error('[Game] Join room error:', err)
        socket.emit('error', { message: 'Server error' })
      }
    })

    socket.on('start_game', ({ roomId } = {}) => {
      const room = rooms[roomId]
      if (!room) return
      if (room.status !== 'WAITING') return
      if (Object.keys(room.players).length < 2) return

      room.status = 'COUNTDOWN'
      let timeLeft = 5
      io.to(roomId).emit('countdown_tick', { timeLeft })

      const countdownInterval = setInterval(() => {
        timeLeft -= 1
        io.to(roomId).emit('countdown_tick', { timeLeft })

        if (timeLeft <= 0) {
          clearInterval(countdownInterval)
          room.status = 'PLAYING'
          io.to(roomId).emit('game_started')

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
            io.to(roomId).emit('new_number_called', { number, letter })
            if (room.calledNumbers.size === 75) {
              clearInterval(room.intervalId)
              room.intervalId = null
              room.status = 'ENDED'
            }
          }, 3000)
        }
      }, 1000)
    })

    socket.on('claim_bingo', async ({ roomId, userId, cardId, markedNumbers }) => {
    console.log('CLAIM RECEIVED:', { roomId, userId, cardId, markedNumbers })
    if (!cardId) return socket.emit('bingo_result', { success: false, message: 'Card ID missing' })

      try {
        let user = null
        if (userId) {
          user = await db('users').where({ id: userId }).first()
          if (!user) user = await db('users').where({ telegram_id: userId }).first()
        }
        if (!user) {
          return socket.emit('bingo_result', { success: false, message: 'User not found' })
        }


        const selections = await db('room_card_selections').where({ room_id: roomId, user_id: user.id })
    const selection = selections.find((s) => (s.card_id || s.card_number) == cardId) || selections[0]


        if (!selection) {
          return socket.emit('bingo_result', { success: false, message: 'Card not found' })
        }

        const cardMatrix = typeof selection.card === 'string'
      ? JSON.parse(selection.card)
      : (selection.card || (typeof selection.matrix === 'string' ? JSON.parse(selection.matrix) : selection.matrix))
        const result = validateBingo(cardMatrix, markedNumbers || [])

        if (result.isValid) {
          const prizePool = rooms[roomId].stake * (rooms[roomId] ? Object.keys(rooms[roomId].players).length : 1)
          const platformFee = prizePool * 0.15
          const payoutAmount = prizePool - platformFee

          if (rooms[roomId]) {
            rooms[roomId].status = 'ENDED'
            rooms[roomId].winner = userId
            if (rooms[roomId].intervalId) { clearInterval(rooms[roomId].intervalId); rooms[roomId].intervalId = null }
          }

          await db.transaction(async (trx) => {
            const winner = await trx('users').where({ id: user.id }).forUpdate().first()
            await trx('users').where({ id: user.id }).increment('wallet_balance', payoutAmount)
            await trx('financial_ledger').insert({
              user_id: user.id,
              amount: payoutAmount,
              type: 'WINNING_PAYOUT',
              reference_id: `ROOM_${roomId}`,
              created_at: new Date(),
            })
          })

          // Notify winner via bot
          try {
            if (user.telegram_id && bot && bot.telegram) {
              await bot.telegram.sendMessage(user.telegram_id, `🎉 *BINGO!* 🎉\nYou won *ETB ${payoutAmount}*!\nYour new balance has been updated in the app.`, { parse_mode: 'Markdown' })
            }
          } catch (err) {
            console.error('Failed to send bot message to winner:', err)
          }

          if (rooms[roomId]) {
            for (const pid in rooms[roomId].players) {
              const p = rooms[roomId].players[pid]
              if (p.userId && p.userId !== user.id) {
                try {
                  const loser = await db('users').where({ id: p.userId }).first()
                  if (loser && loser.telegram_id && bot && bot.telegram) {
                    await bot.telegram.sendMessage(loser.telegram_id, '😔 Game over. A winner has claimed Bingo. Better luck next time!')
                  }
                } catch (err) {}
              }
            }
          }

          socket.emit('bingo_result', {
            success: true,
            message: `BINGO! You won ${payoutAmount} ETB with a ${result.pattern}!`,
            amount: payoutAmount,
          })
          socket.to(roomId).emit('game_over', { winner: { userId: user.id, payout: payoutAmount } })
        } else {
          socket.emit('bingo_result', { success: false, message: 'Not a valid Bingo. Keep playing!' })
        }
      } catch (err) {
        console.error('Claim error:', err)
        socket.emit('bingo_result', { success: false, message: 'Server error validating Bingo' })
      }
    })

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
          const pc = Object.keys(room.players).length
          io.to(roomId).emit('room_update', { playerCount: pc, players: pc })
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
