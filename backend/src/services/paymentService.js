require('dotenv').config()
const db = require('../db')

const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS !== 'false'

async function creditWallet(userId, amount) {
  await db('users')
    .where({ id: userId })
    .increment('wallet_balance', amount)
  return db('users').where({ id: userId }).first()
}

async function initiateTelebirrPayment(amount, userId) {
  if (MOCK_PAYMENTS) {
    // Simulate a successful payment immediately
    const user = await creditWallet(userId, amount)
    return { mock: true, success: true, message: 'Mock Telebirr payment successful', user }
  }

  // --- Real Telebirr H5/App flow (placeholder) ---
  // 1. Build the order payload with merchant info, amount, notify_url, return_url
  // 2. Sign the request with the Telebirr private key
  // 3. POST to Telebirr's create-order endpoint
  // 4. Return the checkout URL from the response
  // TODO: implement with real credentials (TELEBIRR_APP_ID, TELEBIRR_APP_KEY, etc.)
  throw new Error('Real Telebirr integration not implemented. Set MOCK_PAYMENTS=true.')
}

async function initiateCBEBirrPayment(amount, userId) {
  if (MOCK_PAYMENTS) {
    const user = await creditWallet(userId, amount)
    return { mock: true, success: true, message: 'Mock CBE Birr payment successful', user }
  }

  // --- Real CBE Birr flow (placeholder) ---
  // TODO: implement with real credentials
  throw new Error('Real CBE Birr integration not implemented. Set MOCK_PAYMENTS=true.')
}

async function handleTelebirrWebhook(payload) {
  if (MOCK_PAYMENTS) {
    // In mock mode webhooks are not used
    return { success: true, message: 'Mock mode: webhook ignored' }
  }

  // --- Verify Telebirr signature ---
  // const { outTradeNo, totalAmount, ... } = payload
  // verify signature using Telebirr public key
  // credit wallet if valid
  // TODO: implement verification + creditWallet
  return { success: false, message: 'Not implemented' }
}

async function handleCBEWebhook(payload) {
  if (MOCK_PAYMENTS) {
    return { success: true, message: 'Mock mode: webhook ignored' }
  }

  // TODO: implement CBE Birr callback verification + creditWallet
  return { success: false, message: 'Not implemented' }
}

module.exports = {
  MOCK_PAYMENTS,
  creditWallet,
  initiateTelebirrPayment,
  initiateCBEBirrPayment,
  handleTelebirrWebhook,
  handleCBEWebhook,
}
