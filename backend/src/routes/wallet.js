const express = require('express')
const router = express.Router()
const db = require('../db')
const ps = require('../services/paymentService')

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

// POST /api/wallet/deposit/initiate
router.post('/deposit/initiate', async (req, res) => {
  try {
    const { userId, amount, provider } = req.body
    if (!userId || !amount || !provider) return res.status(400).json({ error: 'Missing fields' })
    const user = await db('users').where({ id: userId }).orWhere({ telegram_id: userId }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })

    let result
    if (provider === 'telebirr') {
      result = await ps.initiateTelebirrDeposit(user.id, amount)
    } else if (provider === 'cbebirr' || provider === 'cbe') {
      result = await ps.initiateCBEBirrDeposit(user.id, amount)
    } else {
      return res.status(400).json({ error: 'Unsupported provider' })
    }
    res.json({ checkoutUrl: result.checkoutUrl, transactionReference: result.transactionReference, mock: result.mock })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/wallet/deposit/verify
router.post('/deposit/verify', async (req, res) => {
  try {
    const { userId, reference, provider } = req.body
    if (!userId || !reference || !provider) return res.status(400).json({ error: 'Missing fields' })

    // dedup check
    const existing = await db('payments').where({ transaction_reference: reference }).first()
    if (existing && existing.status === 'completed') {
      return res.status(400).json({ error: 'Ticket already used' })
    }

    const user = await db('users').where({ id: userId }).orWhere({ telegram_id: userId }).first()
    if (!user) return res.status(404).json({ error: 'User not found' })

    const verify = provider === 'telebirr'
      ? await ps.verifyTelebirrTransaction(reference)
      : await ps.verifyCBEBirrTransaction(reference)

    if (!verify.valid) {
      await db('payments').where({ transaction_reference: reference }).update({ status: 'failed' })
      return res.status(400).json({ error: verify.error || 'Verification failed' })
    }

    // if mock, amount may be null; use payment record amount
    const payment = await db('payments').where({ transaction_reference: reference }).first()
    const amount = verify.amount || (payment ? payment.amount : 0)

    await db.transaction(async (trx) => {
      await trx('payments').where({ transaction_reference: reference }).update({ status: 'completed', provider_response: verify })
      await trx('users').where({ id: user.id }).increment('demo_wallet_balance', amount)
      const hasLedger = await trx.schema.hasTable('financial_ledger')
      if (hasLedger) {
        await trx('financial_ledger').insert({
          user_id: user.id,
          type: 'deposit',
          amount,
          reference,
          created_at: new Date(),
        })
      }
    })

    const updated = await db('users').where({ id: user.id }).first()
    res.json({ success: true, newBalance: updated.demo_wallet_balance })
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

