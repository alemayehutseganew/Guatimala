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

// POST /api/wallet/withdraw
router.post('/withdraw', async (req, res) => {
  try {
    const { userId, amount, provider, phoneNumber } = req.body
    if (!userId || !amount || !provider) return res.status(400).json({ error: 'Missing fields' })
    if (Number(amount) < 100) return res.status(400).json({ error: 'Minimum withdrawal is 100 ETB' })

    const user = await db('users').where({ id: userId }).orWhere({ telegram_id: userId }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (Number(user.demo_wallet_balance) < Number(amount)) return res.status(400).json({ error: 'Insufficient balance' })

    const reference = `WD-${Date.now()}-${user.id}`
    await db('users').where({ id: user.id }).decrement('demo_wallet_balance', amount)
    await db('payments').insert({
      user_id: user.id,
      type: 'withdrawal',
      provider,
      amount,
      status: 'pending',
      transaction_reference: reference,
      provider_response: { phoneNumber },
    })

    res.json({ success: true, message: 'Withdrawal request submitted', reference })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router