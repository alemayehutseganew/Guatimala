const express = require('express')
const router = express.Router()
const db = require('../db')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { adminAuth, JWT_SECRET } = require('../middleware/adminAuth')

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
    const totalUsers = await db('users').count('* as c').first()
    const totalRooms = await db('rooms').count('* as c').first()
    const activeGames = await db('rooms').where({ status: 'PLAYING' }).count('* as c').first()
    const wagered = await db('rooms').sum('stake_amount as s').first()
    const profit = await db('payments').where({ type: 'deposit', status: 'completed' }).sum('amount as a').first()
    res.json({
      totalUsers: Number(totalUsers.c),
      totalRooms: Number(totalRooms.c),
      totalWagered: Number(wagered.s || 0),
      totalPlatformProfit: Number(profit.a || 0),
      activeGames: Number(activeGames.c),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const offset = (page - 1) * limit
    const users = await db('users')
      .select('id', 'telegram_id', 'first_name', 'wallet_balance', 'demo_wallet_balance', 'created_at')
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
      await db('users').where({ id: user.id }).increment('demo_wallet_balance', amt)
    } else if (type === 'subtract') {
      await db('users').where({ id: user.id }).decrement('demo_wallet_balance', amt)
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
    const rooms = await db('rooms')
      .select('id', 'stake_amount', 'status', 'winning_pattern', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(50)
    const result = []
    for (const r of rooms) {
      const participants = await db('room_participants').where({ room_id: r.id }).count('* as c').first()
      const winnerRow = await db('room_participants').where({ room_id: r.id, is_winner: true }).first()
      let winnerName = null
      if (winnerRow) {
        const u = await db('users').where({ id: winnerRow.user_id }).first()
        winnerName = u?.first_name || u?.username || null
      }
      result.push({
        room_id: r.id,
        stake: r.stake_amount,
        status: r.status,
        participants: Number(participants.c),
        winner: winnerName,
        created_at: r.created_at,
      })
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/payments', adminAuth, async (req, res) => {
  try {
    const payments = await db('payments')
      .select('id', 'user_id', 'type', 'provider', 'amount', 'status', 'transaction_reference', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(100)
    res.json(payments)
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

module.exports = router
