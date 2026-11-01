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
    console.log('[join] Request received for stake:', req.body.stake)
    const entryFee = Number(req.body.stake || req.body.level || 0)
    const userId = req.body.userId

    let user = null
    if (userId) {
      user = await db('users').where({ id: userId }).first()
      if (!user) user = await db('users').where({ telegram_id: userId }).first()
    }
    console.log('[join] User found:', user ? user.id : 'NOT FOUND')
    if (!user) return res.status(404).json({ error: 'User not found' })

    console.log('[join] Checking balance. Current:', user.wallet_balance)

    const result = await db.transaction(async (trx) => {
      console.log('[join] Transaction started')

      const lockedUser = await trx('users').where({ id: user.id }).forUpdate().first()
      console.log('[join] User row locked. Balance:', lockedUser.wallet_balance)

      if (Number(lockedUser.wallet_balance || 0) < entryFee) {
        console.log('[join] Insufficient balance')
        const error = new Error('INSUFFICIENT_BALANCE')
        error.code = 'INSUFFICIENT_BALANCE'
        throw error
      }

      let room = await trx('game_rooms').where({ stake_amount: entryFee, status: 'WAITING' }).forUpdate().first()
      console.log('[join] Room found/created:', room ? room.id : 'Creating new room')

      if (!room) {
        const [newRoom] = await trx('game_rooms').insert({
          stake_amount: entryFee,
          status: 'WAITING',
          called_numbers: JSON.stringify([])
        }).returning('*')
        room = newRoom
        console.log('[join] New room created:', room.id)
      }

      const existing = await trx('room_participants').where({ room_id: room.id, user_id: user.id }).first()
      if (existing) {
        console.log('[join] User already in room')
        return { room, alreadyJoined: true }
      }

      console.log('[join] Deducting balance...')
      await trx('users').where({ id: user.id }).decrement('wallet_balance', entryFee)

      console.log('[join] Inserting participant...')
      await trx('room_participants').insert({
        room_id: room.id,
        user_id: user.id,
        is_winner: false
      })

      console.log('[join] Inserting ledger...')
      await trx('financial_ledger').insert({
        user_id: user.id,
        amount: -entryFee,
        type: 'ENTRY_FEE',
        reference: `ROOM_${room.id}`,
        created_at: new Date(),
      })

      console.log('[join] Transaction successful')
      return { room, alreadyJoined: false }
    })

    console.log('[join] Sending response:', result.room.id)
    if (result.alreadyJoined) {
      return res.json({ roomId: result.room.id, stake: result.room.stake_amount, message: 'Already joined' })
    }
    return res.json({ roomId: result.room.id, stake: result.room.stake_amount, message: 'Entry fee deducted' })
  } catch (err) {
    console.error('[join] CATCH ERROR:', err.message)
    if (err.code === 'INSUFFICIENT_BALANCE' || err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'INSUFFICIENT_BALANCE', message: 'Not enough balance.' })
    }
    res.status(500).json({ error: 'JOIN_FAILED', message: err.message })
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
