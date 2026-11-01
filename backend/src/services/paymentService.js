const db = require('../db')

function parseTelebirrSMS(smsText) {
  if (!smsText) return null

  const idMatch = smsText.match(/Your transaction number is\s+([A-Z0-9]+)/i)
  const transactionId = idMatch ? idMatch[1] : null

  const amountMatch = smsText.match(/(?:paid|transferred)\s+ETB\s+([0-9.]+)/i)
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null

  const payerMatch = smsText.match(/Dear\s+([A-Za-z\s]+)/i)
  const payerName = payerMatch ? payerMatch[1].trim() : null

  const receiverMatch = smsText.match(/to\s+([A-Za-z\s]+)\s+\(([0-9*]+)\)/i)
  const receiverName = receiverMatch ? receiverMatch[1].trim() : null
  const receiverNumber = receiverMatch ? receiverMatch[2] : null

  if (!transactionId || !amount || !receiverName) {
    return null
  }

  return {
    transactionId,
    amount,
    payerName,
    receiverName,
    receiverNumber,
    rawText: smsText,
  }
}

async function verifyTelebirrReceipt(reference) {
  try {
    const response = await fetch('https://cheki.et/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank: 'telebirr',
        reference: reference
      })
    })

    const data = await response.json()

    if (!data.success || !data.verified) {
      return {
        success: false,
        error: data.error || data.message || 'Receipt not found or not verified by Telebirr.'
      }
    }

    const amount = parseFloat(data.amount)
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Invalid amount on receipt.' }
    }

    const OUR_NAME = 'ALEMAYEHU TSEGANEW'
    if (data.receiverName && !data.receiverName.toUpperCase().includes(OUR_NAME)) {
      return {
        success: false,
        error: 'This receipt was not sent to our platform account.'
      }
    }

    return {
      success: true,
      amount: amount,
      payerName: data.senderName || 'Unknown',
      receiverName: data.receiverName || OUR_NAME,
      transactionId: data.reference,
      status: 'Completed'
    }
  } catch (err) {
    console.error('cheki.et verification error:', err.message)
    return { success: false, error: 'Unable to reach verification service. Please try again later.' }
  }
}

async function processDeposit(userId, amount, reference) {
  const existing = await db('payments').where({ transaction_reference: reference }).first()
  if (existing) return { error: 'This receipt has already been used.' }

  const verify = await verifyTelebirrReceipt(reference)
  if (!verify.success) return { error: 'Invalid receipt' }
  if (Math.abs(verify.amount - Number(amount)) > 0.001) {
    return { error: 'Amount mismatch' }
  }

  let newBalance
  await db.transaction(async (trx) => {
    await trx('payments').insert({
      user_id: userId,
      type: 'deposit',
      provider: 'telebirr',
      amount: verify.amount,
      status: 'VERIFIED',
      transaction_reference: reference,
      provider_response: { payerName: verify.payerName },
    })
    await trx('users').where({ id: userId }).increment('wallet_balance', verify.amount)
    const hasLedger = await trx.schema.hasTable('financial_ledger')
    if (hasLedger) {
      await trx('financial_ledger').insert({
        user_id: userId,
        type: 'DEPOSIT',
        amount: verify.amount,
        reference: reference,
        created_at: new Date(),
      })
    }
    const u = await trx('users').where({ id: userId }).first()
    newBalance = u.wallet_balance
  })

  return { success: true, newBalance }
}

module.exports = { verifyTelebirrReceipt, processDeposit, parseTelebirrSMS }
