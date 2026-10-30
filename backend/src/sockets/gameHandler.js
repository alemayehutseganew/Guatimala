const db = require('../db')
const { validateBingo } = require('../utils/bingoValidator')
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

function initGameHandler(io) {
  io.on('connection', (socket) => {
    socket.on('join_room', async (payload = {}) => {
      try {
        const { roomId, userId, cards: clientCards } = payload
        if (!roomId) return

        if (!rooms[roomId]) {
          rooms[roomId] = {
            id: roomId,
            players: {},
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

        room.players[socket.id] = { userId, cards, socketId: socket.id }
        socket.join(roomId)

        const playerCount = Object.keys(room.players).length
        io.to(roomId).emit('room_update', { playerCount, players: playerCount, stake: room.stake })

        if (playerCount >= 1 && room.status === 'WAITING') {
          room.status = 'COUNTDOWN'
          let timeLeft = 5
          io.to(roomId).emit('countdown_tick', { timeLeft })

          const countdownInterval = setInterval(() => {
            timeLeft -= 1
            io.to(roomId).emit('countdown_tick', { timeLeft })

            if (timeLeft <= 0) {
              clearInterval(countdownInterval)
              room.countdown = null
              room.status = 'PLAYING'
              io.to(roomId).emit('game_started')
              startGameLoop(io, roomId)
            }
          }, 1000)

          room.countdown = countdownInterval
        }
      } catch (err) {
        console.error('join_room error:', err)
      }
    })

    socket.on('start_game', ({ roomId } = {}) => {
      const room = rooms[roomId]
      if (!room) return
      if (room.status !== 'WAITING') return
      if (Object.keys(room.players).length < 1) return

      room.status = 'COUNTDOWN'
      let timeLeft = 5
      io.to(roomId).emit('countdown_tick', { timeLeft })

      const countdownInterval = setInterval(() => {
        timeLeft -= 1
        io.to(roomId).emit('countdown_tick', { timeLeft })

        if (timeLeft <= 0) {
          clearInterval(countdownInterval)
          room.countdown = null
          room.status = 'PLAYING'
          io.to(roomId).emit('game_started')
          startGameLoop(io, roomId)
        }
      }, 1000)

      room.countdown = countdownInterval
    })

    socket.on('claim_bingo', async ({ roomId, userId, cardId, markedNumbers }) => {
      try {
        // 1. Fetch the player's actual card from the DB to prevent cheating
        let user = await db('users').where({ id: userId }).first()
        if (!user) {
          user = await db('users').where({ telegram_id: userId }).first()
        }
        if (!user) {
          return socket.emit('bingo_result', { success: false, message: 'User not found' })
        }

        const selection = await db('room_card_selections')
          .where({ room_id: roomId, user_id: user.id, card_id: cardId })
          .first()

        if (!selection) {
          return socket.emit('bingo_result', { success: false, message: 'Card not found' })
        }

        const cardMatrix = typeof selection.card === 'string' ? JSON.parse(selection.card) : selection.card

        // 2. Validate the pattern
        const result = validateBingo(cardMatrix, markedNumbers)

        if (result.isValid) {
          const prizeAmount = 17

          if (rooms[roomId]) {
            rooms[roomId].status = 'ENDED'
            rooms[roomId].winner = userId
            if (rooms[roomId].interval) { clearInterval(rooms[roomId].interval); rooms[roomId].interval = null }
            if (rooms[roomId].countdown) { clearInterval(rooms[roomId].countdown); rooms[roomId].countdown = null }
          }

          socket.emit('bingo_result', {
            success: true,
            message: `BINGO! You won ${prizeAmount} ETB with a ${result.pattern}!`,
            amount: prizeAmount,
          })

          socket.to(roomId).emit('game_over', { winner: user.first_name })
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
        const selections = await db('room_card_selections').where({ room_id: roomId, user_id: userId })
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
          io.to(roomId).emit('room_update', { playerCount: Object.keys(room.players).length, players: Object.keys(room.players).length })
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

module.exports = { initGameHandler, setupSocket, rooms, startGameLoop }
