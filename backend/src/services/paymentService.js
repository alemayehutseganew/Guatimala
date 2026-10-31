require('dotenv').config()
const db = require('../db')

const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS !== 'false'

async function creditWallet(userId, amount) {
  await db('users').where({ id: userId }).increment('demo_wallet_balance', amount)
  return db('users').where({ id: userId }).first()
}

async function verifyTelebirrTransaction(reference) {
  if (MOCK_PAYMENTS) {
    return { valid: true, amount: null, payerName: 'Mock Payer' }
  }
  try {
    return { valid: false, error: 'Telebirr verification not implemented. Set MOCK_PAYMENTS=true.' }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

async function verifyCBEBirrTransaction(reference) {
  if (MOCK_PAYMENTS) {
    return { valid: true, amount: null, payerName: 'Mock Payer' }
  }
  try {
    return { valid: false, error: 'CBE Birr verification not implemented. Set MOCK_PAYMENTS=true.' }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

async function initiateTelebirrDeposit(userId, amount) {
  const outTradeNo = `DEP-${Date.now()}-${userId}`
  await db('payments').insert({
    user_id: userId,
    type: 'deposit',
    provider: 'telebirr',
    amount,
    status: 'pending',
    transaction_reference: outTradeNo,
  })
  if (MOCK_PAYMENTS) {
    await db('payments').where({ transaction_reference: outTradeNo }).update({ status: 'completed' })
    await creditWallet(userId, amount)
    return { checkoutUrl: null, transactionReference: outTradeNo, mock: true }
  }
  const checkoutUrl = `https://example.com/telebirr/checkout?ref=${outTradeNo}`
  return { checkoutUrl, transactionReference: outTradeNo }
}

async function initiateCBEBirrDeposit(userId, amount) {
  const outTradeNo = `DEP-${Date.now()}-${userId}`
  await db('payments').insert({
    user_id: userId,
    type: 'deposit',
    provider: 'cbebirr',
    amount,
    status: 'pending',
    transaction_reference: outTradeNo,
  })
  if (MOCK_PAYMENTS) {
    await db('payments').where({ transaction_reference: outTradeNo }).update({ status: 'completed' })
    await creditWallet(userId, amount)
    return { checkoutUrl: null, transactionReference: outTradeNo, mock: true }
  }
  const checkoutUrl = `https://example.com/cbebirr/checkout?ref=${outTradeNo}`
  return { checkoutUrl, transactionReference: outTradeNo }
}

async function initiateTelebirrPayment(amount, userId) {
  const r = await initiateTelebirrDeposit(userId, amount)
  const user = await db('users').where({ id: userId }).first()
  return { mock: MOCK_PAYMENTS, success: true, message: 'Telebirr payment initiated', user, ...r }
}

async function initiateCBEBirrPayment(amount, userId) {
  const r = await initiateCBEBirrDeposit(userId, amount)
  const user = await db('users').where({ id: userId }).first()
  return { mock: MOCK_PAYMENTS, success: true, message: 'CBE Birr payment initiated', user, ...r }
}

async function handleTelebirrWebhook(payload) {
  return { success: true, message: 'Mock mode: webhook ignored' }
}

async function handleCBEWebhook(payload) {
  return { success: true, message: 'Mock mode: webhook ignored' }
}

module.exports = {
  MOCK_PAYMENTS,
  creditWallet,
  verifyTelebirrTransaction,
  verifyCBEBirrTransaction,
  initiateTelebirrDeposit,
  initiateCBEBirrDeposit,
  initiateTelebirrPayment,
  initiateCBEBirrPayment,
  handleTelebirrWebhook,
  handleCBEWebhook,
}
