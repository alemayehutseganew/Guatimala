const express = require('express')
const router = express.Router()
const db = require('../db')
const { generateCardMatrix } = require('../utils/roomCardGenerator')

// POST /api/rooms/join
// Body: { stake }
router.post('/join', async (req, res) => {
  try {
    const { stake } = req.body || {}
    if (stake === undefined || stake === null) {
      return res.status(400).json({ error: 'stake is required' })
    }

    // Look for a waiting room with this stake
    let room = await db('rooms').where({ stake_amount: stake, status: 'WAITING' }).first()

    // If no room exists, create one
    if (!room) {
      const [newRoom] = await db('rooms')
        .insert({ stake_amount: stake, status: 'WAITING' })
        .returning('*')
      room = newRoom
    }

    return res.json({ roomId: room.id, stake: room.stake_amount })
  } catch (err) {
    console.error('join room error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// GET /api/rooms/:roomId/cards
router.get('/:roomId/cards', (req, res) => {
  const cards = []
  for (let i = 1; i <= 400; i++) {
    cards.push({
      id: i,
      card_number: i,
      taken: false,
      matrix: generateCardMatrix(i),
    })
  }
  res.json(cards)
})

// POST /api/rooms/:id/select-cards
// Body: { userId, cardIds: [1,2,...] }
router.post('/:id/select-cards', async (req, res) => {
  try {
    const roomId = req.params.id
    const { userId, cardIds } = req.body || {}
    if (!userId || !Array.isArray(cardIds)) {
      return res.status(400).json({ error: 'userId and cardIds are required' })
    }

    // Remove any previous selections for this user/room
    await db('room_card_selections').where({ room_id: roomId, user_id: userId }).del()

    const rows = cardIds.map((cardId) => ({
      room_id: roomId,
      user_id: userId,
      card_number: cardId,
      matrix: JSON.stringify(generateCardMatrix(cardId)),
    }))

    if (rows.length) {
      await db('room_card_selections').insert(rows)
    }

    return res.json({ success: true, count: rows.length })
  } catch (err) {
    console.error('select-cards error:', err)
    return res.status(500).json({ error: 'server error' })
  }
})

// GET /api/rooms/:id/my-cards?userId=...
router.get('/:id/my-cards', async (req, res) => {
  try {
    const roomId = req.params.id
    const userId = req.query.userId
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    const rows = await db('room_card_selections')
      .where({ room_id: roomId, user_id: userId })
      .select('card_number', 'matrix')
    const cards = rows.map((r) => ({
      card_number: r.card_number,
      matrix: typeof r.matrix === 'string' ? JSON.parse(r.matrix) : r.matrix,
    }))
    return res.json(cards)
  } catch (err) {
    console.error('my-cards error:', err)
    return res.status(500).json({ error: 'server error' })
  }
})

module.exports = router

