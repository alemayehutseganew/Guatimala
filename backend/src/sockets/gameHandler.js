const db = require('../db')
const { validateBingo } = require('../utils/patternValidator')
const { Server } = require('socket.io')

function getLetterForNumber(num) {
  if (num <= 15) return 'B'
  if (num <= 30) return 'I'
  if (num <= 45) return 'N'
  if (num <= 60) return 'G'
  return 'O'
}

function initGameHandler(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', async (payload = {}) => {
      try {
        const { roomId, userId, cards: clientCards } = payload
        if (!roomId) return

        if (!rooms[roomId]) {
          rooms[roomId] = {
            id: roomId,
            players: new Map(),
            calledNumbers: [],
            status: 'WAITING',
            interval: null,
            countdown: null,
          }
        }

        const room = rooms[roomId]

        // Fetch the user's cards from the database when possible
        let cards = Array.isArray(clientCards) ? clientCards : []
        if (userId) {
          try {
            const dbCards = await db('room_cards').where({ room_id: roomId, user_id: userId })
            if (dbCards && dbCards.length) {
              cards = dbCards.map((c) => c.matrix)
            }
          } catch (e) {
            // Fall back to provided cards if DB lookup fails
          }
        }

        room.players.set(socket.id, { userId, cards, socketId: socket.id })
        socket.join(roomId)

        io.to(roomId).emit('room_update', { playerCount: room.players.size })
      } catch (err) {
        console.error('join_room error:', err)
      }
    })

    socket.on('start_game', ({ roomId } = {}) => {
      const room = rooms[roomId]
      if (!room) return
      if (room.status !== 'WAITING') return
      if (room.players.size < 2) return

      room.status = 'COUNTDOWN'
      let count = 5

      room.countdown = setInterval(() => {
        io.to(roomId).emit('countdown_tick', count)
        count -= 1

        if (count < 0) {
          clearInterval(room.countdown)
          room.countdown = null
          room.status = 'PLAYING'
          room.calledNumbers = []

          room.interval = setInterval(() => {
            const available = []
            for (let n = 1; n <= 75; n++) {
              if (!room.calledNumbers.includes(n)) available.push(n)
            }
            if (available.length === 0) {
              clearInterval(room.interval)
              room.interval = null
              return
            }
            const num = available[Math.floor(Math.random() * available.length)]
            room.calledNumbers.push(num)
            io.to(roomId).emit('new_number_called', {
              number: num,
              letter: getLetterForNumber(num),
              calledNumbers: room.calledNumbers,
            })
          }, 3000)
        }
      }, 1000)
    })

    socket.on('claim_bingo', ({ roomId, card } = {}) => {
      const room = rooms[roomId]
      if (!room || room.status !== 'PLAYING') return

      const player = room.players.get(socket.id)
      const cardToCheck = card || (player && player.cards && player.cards[0])
      if (!cardToCheck) return

      const result = validateBingo(cardToCheck, room.calledNumbers)

      if (result.isValid) {
        room.status = 'ENDED'
        if (room.interval) {
          clearInterval(room.interval)
          room.interval = null
        }
        if (room.countdown) {
          clearInterval(room.countdown)
          room.countdown = null
        }

        io.to(roomId).emit('game_over', {
          winner: {
            userId: player ? player.userId : null,
            socketId: socket.id,
          },
          pattern: result.pattern,
        })
      } else {
        socket.emit('bingo_invalid', { message: 'Not a valid bingo' })
      }
    })

    socket.on('disconnect', () => {
      for (const roomId in rooms) {
        const room = rooms[roomId]
        if (room.players.has(socket.id)) {
          room.players.delete(socket.id)
          io.to(roomId).emit('room_update', { playerCount: room.players.size })
        }
      }
    })
  })
}

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })
  initGameHandler(io)
  return io
}

module.exports = { initGameHandler, setupSocket, rooms }

