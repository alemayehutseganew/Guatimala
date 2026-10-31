const express = require('express')
const router = express.Router()
const db = require('../db')
const { generateSingleCard } = require('../utils/cardGenerator')

// GET /api/rooms (list waiting rooms)
router.get('/', async (req, res) => {
  try {
    const rooms = await db('game_rooms').where({ status: 'WAITING' })
    res.json({ rooms })
  } catch (err) {
    res.status(500).json({ error: 'Failed' })
  }
})
router.post('/join', async (req, res) => {
  try {
    const { stake, userId } = req.body
    console.log(`[join] Request received for stake: ${stake}`)

    let room = await db('game_rooms').where({ stake_amount: stake, status: 'WAITING' }).first()

    if (!room) {
      const [newRoom] = await db('game_rooms').insert({
        stake_amount: stake,
        status: 'WAITING',
        called_numbers: JSON.stringify([])
      }).returning('*')
      room = newRoom
      console.log(`[join] Created new room: ${room.id}`)
    }

    const entryFee = Number(stake) || 0

    if (userId) {
      let user = await db('users').where({ id: userId }).first()
      if (!user) user = await db('users').where({ telegram_id: userId }).first()

      if (!user) return res.status(404).json({ error: 'User not found' })

      const result = await db.transaction(async (trx) => {
        const lockedUser = await trx('users').where({ id: user.id }).forUpdate().first()
        const currentBalance = Number(lockedUser.wallet_balance || 0)

        if (currentBalance < entryFee) {
          throw new Error('Insufficient real balance. Please deposit funds.')
        }

        await trx('users').where({ id: user.id }).decrement('wallet_balance', entryFee)

        const hasLedger = await trx.schema.hasTable('financial_ledger')
        if (hasLedger) {
          await trx('financial_ledger').insert({
            user_id: user.id,
            amount: -entryFee,
            type: 'ENTRY_FEE',
            reference: `ROOM_${room.id}`,
            created_at: new Date(),
          })
        }

        await trx('room_participants').insert({
          room_id: room.id,
          user_id: user.id,
        })

        return { room, selectedCards: [] }
      })

      return res.json({ roomId: room.id, stake: room.stake_amount, ...result })
    }

    res.json({ roomId: room.id, stake: room.stake_amount })
  } catch (err) {
    console.error('[join] Error:', err)
    res.status(500).json({ error: err.message })
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
      matrix: generateSingleCard(),
    })
  }
  res.json(cards)
})

// POST /api/rooms/:id/cards/:cardId
router.post('/:id/cards/:cardId', async (req, res) => {
  try {
    const { id: roomId, cardId } = req.params
    const { userId } = req.body

    const user = await db('users').where({ id: userId }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })

    const matrix = generateSingleCard()

    await db('room_card_selections').insert({
      room_id: roomId,
      card_id: parseInt(cardId),
      user_id: user.id,
      card: JSON.stringify(matrix),
      status: 'reserved'
    })

    res.json({ success: true, cardId, matrix })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to save card' })
  }
})

// POST /api/rooms/:id/select-cards (bulk, kept for compatibility)
router.post('/:id/select-cards', async (req, res) => {
  try {
    const roomId = req.params.id
    const { userId, cardIds } = req.body || {}
    if (!userId || !Array.isArray(cardIds)) {
      return res.status(400).json({ error: 'userId and cardIds are required' })
    }

    await db('room_card_selections').where({ room_id: roomId, user_id: userId }).del()

    const rows = cardIds.map((cardId) => ({
      room_id: roomId,
      card_id: cardId,
      user_id: userId,
      card: JSON.stringify(generateSingleCard()),
      status: 'reserved',
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


// GET /api/rooms/:id/my-cards
router.get('/:id/my-cards', async (req, res) => {
  try {
    const roomId = req.params.id
    const { userId } = req.query

    if (!roomId || !userId) {
      return res.status(400).json({ error: 'roomId and userId are required' })
    }

    let user = await db('users').where({ id: userId }).first()
    if (!user) {
      user = await db('users').where({ telegram_id: userId }).first()
    }

    if (!user) {
      console.log(`[my-cards] User not found for ID/Telegram: ${userId}`)
      return res.json({ cards: [] })
    }

    const selections = await db('room_card_selections').where({ room_id: roomId, user_id: user.id })
    console.log(`[my-cards] Found ${selections.length} cards for DB user ${user.id} in room ${roomId}`)

    const cards = selections.map((selection) => ({
      id: selection.card_id,
      matrix: typeof selection.card === 'string' ? JSON.parse(selection.card) : selection.card,
    }))

    return res.json({ cards })
  } catch (error) {
    console.error('[my-cards] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch cards' })
  }
})

module.exports = router
