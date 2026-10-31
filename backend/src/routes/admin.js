const express = require('express')
const router = express.Router()
const db = require('../db')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { adminAuth, JWT_SECRET } = require('../middleware/adminAuth')
const archiveData = require('../../scripts/archive_old_data');
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

function verifyPassword(password, stored) {
  const [salt, derived] = stored.split(':')
  const check = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(derived, 'hex'))
}

// seed default admin if none
async function seedAdmin() {
  try {
    const existing = await db('admins').where({ username: 'alex' }).first()
    if (!existing) {
      await db('admins').insert({ username: 'alex', password_hash: hashPassword('Alex@8989') })
      console.log('✅ Admin seeded (alex)')
    } else {
      await db('admins').where({ username: 'alex' }).update({ password_hash: hashPassword('Alex@8989') })
      console.log('✅ Admin password updated (alex)')
    }
  } catch (e) {
    console.error('Admin seed error:', e.message)
  }
}
seedAdmin()

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const admin = await db('admins').where({ username }).first()
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const userCountResult = await db('users').count('* as count').first()
    const totalUsers = parseInt(userCountResult.count, 10)

    const activeGamesResult = await db('rooms')
      .whereIn('status', ['WAITING', 'COUNTDOWN', 'PLAYING'])
      .count('* as count')
      .first()
    const activeGames = parseInt(activeGamesResult.count, 10)

    // Total Wagered: sum of stakes across all room participants (each player's entry)
    const wageredResult = await db('rooms')
      .join('room_participants', 'rooms.id', 'room_participants.room_id')
      .sum('rooms.stake_amount as total')
      .first()
    const totalWagered = parseFloat(wageredResult.total || 0).toFixed(2)

    // Platform Profit: Total Wagered - Total Payouts (game_win ledger entries)
    const payoutsResult = await db('financial_ledger')
      .where({ type: 'game_win' })
      .sum('amount as total')
      .first()
    const totalPayouts = parseFloat(payoutsResult.total || 0).toFixed(2)

    const platformProfit = (parseFloat(totalWagered) - parseFloat(totalPayouts)).toFixed(2)

    res.json({
      totalUsers,
      activeGames,
      totalWagered,
      totalPayouts,
      platformProfit,
    })
  } catch (err) {
    console.error('Stats error:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit
    const users = await db('users')
      .select('id', 'telegram_id', 'first_name', 'wallet_balance', 'created_at')
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset)
    const total = await db('users').count('* as c').first()
    res.json({ users, total: Number(total.c), page, limit })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/users/:id/adjust-balance', adminAuth, async (req, res) => {
  try {
    const { amount, type } = req.body
    const user = await db('users').where({ id: req.params.id }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })
    const amt = Number(amount)
    if (type === 'add') {
      await db('users').where({ id: user.id }).increment('wallet_balance', amt)
    } else if (type === 'subtract') {
      await db('users').where({ id: user.id }).decrement('wallet_balance', amt)
    } else {
      return res.status(400).json({ error: 'Invalid type' })
    }
    const hasLedger = await db.schema.hasTable('financial_ledger')
    if (hasLedger) {
      await db('financial_ledger').insert({
        user_id: user.id,
        type: `admin_${type}`,
        amount: amt,
        reference: `ADMIN-${Date.now()}`,
        created_at: new Date(),
      })
    }
    const updated = await db('users').where({ id: user.id }).first()
    res.json({ success: true, user: updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/games', adminAuth, async (req, res) => {
  try {
    const games = await db('rooms')
      .select(
        'rooms.id',
        'rooms.stake_amount',
        'rooms.status',
        'rooms.created_at',
        db.raw('COUNT(room_participants.id) as total_players')
      )
      .leftJoin('room_participants', 'rooms.id', 'room_participants.room_id')
      .groupBy('rooms.id')
      .orderBy('rooms.created_at', 'desc')
      .limit(100)

    const gameIds = games.map(g => g.id)
    const winners = await db('room_participants')
      .join('users', 'room_participants.user_id', 'users.id')
      .whereIn('room_participants.room_id', gameIds)
      .andWhere('room_participants.is_winner', true)
      .select('room_participants.room_id', 'users.first_name', 'users.username')

    const winnerMap = {}
    winners.forEach(w => winnerMap[w.room_id] = w.first_name || w.username || 'Unknown')

    const result = games.map(g => ({
      ...g,
      winner_name: winnerMap[g.id] || 'No Winner / In Progress'
    }))

    res.json({ games: result })
  } catch (err) {
    console.error('Games fetch error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/payments', adminAuth, async (req, res) => {
  try {
    const transactions = await db('financial_ledger')
      .join('users', 'financial_ledger.user_id', 'users.id')
      .select(
        'financial_ledger.id',
        'users.first_name',
        'users.username',
        'users.telegram_id',
        'financial_ledger.amount',
        db.raw("CASE financial_ledger.type WHEN 'game_win' THEN 'WINNING_PAYOUT' WHEN 'admin_add' THEN 'ADMIN_ADJUSTMENT' WHEN 'admin_subtract' THEN 'ADMIN_ADJUSTMENT' ELSE UPPER(financial_ledger.type) END as type"),
        'financial_ledger.reference as reference_id',
        'financial_ledger.created_at'
      )
      .orderBy('financial_ledger.created_at', 'desc')
      .limit(200)

    res.json({ transactions })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/payments/:id/approve', adminAuth, async (req, res) => {
  try {
    const p = await db('payments').where({ id: req.params.id }).first()
    if (!p) return res.status(404).json({ error: 'Not found' })
    await db('payments').where({ id: p.id }).update({ status: 'completed' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/reset-balances', adminAuth, async (req, res) => {
  try {
    await db('users').update({ wallet_balance: 0 })
    res.json({ success: true, message: 'All wallet balances reset to 0' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
router.post('/archive-data', adminAuth, async (req, res) => {
  try {
    const r = await archiveOldData()
    res.json({ success: true, ...r })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


module.exports = router
