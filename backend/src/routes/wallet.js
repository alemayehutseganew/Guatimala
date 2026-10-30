const express = require('express')
const router = express.Router()
const db = require('../db')

// GET /api/wallet/balance?userId=...
router.get('/balance', async (req, res) => {
  try {
    const { userId } = req.query
    const user = await db('users').where({ id: userId }).orWhere({ telegram_id: userId }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ balance: user.demo_wallet_balance || 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
