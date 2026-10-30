const express = require('express')
const router = express.Router()
const db = require('../db')

// GET /api/wallet/balance?userId=...
router.get('/balance', async (req, res) => {
  try {
    const userId = req.query.userId
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    let user = await db('users').where({ id: userId }).first()
    if (!user) user = await db('users').where({ telegram_id: userId }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({ balance: Number(user.wallet_balance ?? 0), demo_balance: Number(user.demo_wallet_balance ?? 0) })
  } catch (err) {
    console.error('wallet balance error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
