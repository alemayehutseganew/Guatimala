const db = require('../db')
const { validateBingo } = require('../utils/patternValidator')
const { Server } = require('socket.io')

const rooms = {}

function getLetterForNumber(num) {
  if (num <= 15) return 'B'
  if (num <= 30) return 'I'
  if (num <= 45) return 'N'
  if (num <= 60) return 'G'
  return 'O'
}

function startGameLoop(io, roomId) {
  const room = rooms[roomId]
  if (!room) return
  room.status = 'PLAYING'
  room.calledNumbers = new Set()

  room.interval = setInterval(() => {
    if (room.status !== 'PLAYING') {
      clearInterval(room.interval)
      room.interval = null
      return
    }
    const available = []
    for (let n = 1; n <= 75; n++) {
      if (!room.calledNumbers.has(n)) available.push(n)
    }
    if (available.length === 0) {
      clearInterval(room.interval)
      room.interval = null
      room.status = 'ENDED'
      return
    }
    const num = available[Math.floor(Math.random() * available.length)]
    room.calledNumbers.add(num)
    let letter = 'B'
    if (num > 15) letter = 'I'
    if (num > 30) letter = 'N'
    if (num > 45) letter = 'G'
    if (num > 60) letter = 'O'
    io.to(roomId).emit('new_number_called', {
      number: num,
      letter,
      calledNumbers: Array.from(room.calledNumbers),
    })
    if (room.calledNumbers.size === 75) {
      clearInterval(room.interval)
      room.interval = null
      room.status = 'ENDED'
    }
  }, 3000)
}

function startCountdown(io, roomId) {
  const room = rooms[roomId]
  if (!room || room.status !== 'WAITING') return
  if (room.players.size < 1) return

  room.status = 'COUNTDOWN'
  let timeLeft = 5
  io.to(roomId).emit('countdown_tick', { timeLeft })

  room.countdown = setInterval(() => {
    timeLeft -= 1
    io.to(roomId).emit('countdown_tick', { timeLeft })

    if (timeLeft <= 0) {
      clearInterval(room.countdown)
      room.countdown = null
      room.status = 'PLAYING'
      io.to(roomId).emit('game_started')
      startGameLoop(io, roomId)
    }
  }, 1000)
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
            calledNumbers: new Set(),
            status: 'WAITING',
            interval: null,
            countdown: null,
            stake: null,
          }
        }

        const room = rooms[roomId]

        let cards = Array.isArray(clientCards) ? clientCards : []
        if (userId) {
          try {
            const dbCards = await db('room_cards').where({ room_id: roomId, user_id: userId })
            if (dbCards && dbCards.length) {
              cards = dbCards.map((c) => c.matrix)
            }
          } catch (e) {}
        }

        room.players.set(socket.id, { userId, cards, socketId: socket.id })
        socket.join(roomId)

        const playerCount = room.players.size
        io.to(roomId).emit('room_update', { playerCount, players: playerCount, stake: room.stake })

        if (playerCount >= 1 && room.status === 'WAITING') {
          startCountdown(io, roomId)
        }
      } catch (err) {
        console.error('join_room error:', err)
      }
    })

    socket.on('start_game', ({ roomId } = {}) => {
      const room = rooms[roomId]
      if (!room) return
      if (room.status !== 'WAITING') return
      if (room.players.size < 1) return
      startCountdown(io, roomId)
    })

    socket.on('claim_bingo', ({ roomId, card } = {}) => {
      const room = rooms[roomId]
      if (!room || room.status !== 'PLAYING') return

      const player = room.players.get(socket.id)
      const cardToCheck = card || (player && player.cards && player.cards[0])
      if (!cardToCheck) return

      const result = validateBingo(cardToCheck, Array.from(room.calledNumbers))

      if (result.isValid) {
        room.status = 'ENDED'
        if (room.interval) { clearInterval(room.interval); room.interval = null }
        if (room.countdown) { clearInterval(room.countdown); room.countdown = null }

        io.to(roomId).emit('game_over', {
          winner: { userId: player ? player.userId : null, socketId: socket.id },
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
          io.to(roomId).emit('room_update', { playerCount: room.players.size, players: room.players.size })
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

module.exports = { initGameHandler, setupSocket, rooms, startGameLoop, startCountdown }
