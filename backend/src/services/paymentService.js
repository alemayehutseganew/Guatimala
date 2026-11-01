const db = require('../db')

let VerificationEngine = null
try {
  VerificationEngine = require('@localpay/verification-engine').VerificationEngine
} catch (e) {
  VerificationEngine = null
}

const engine = VerificationEngine ? new VerificationEngine() : null

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

async function verifyTelebirrReceipt(smsText) {
  if (!engine) {
    return { success: false, error: 'Verification service unavailable.' }
  }

  // If the input looks like a full SMS, use the engine
  if (smsText && /transaction number|paid|transferred/i.test(smsText)) {
    try {
      const result = await engine.verify({
        bank: 'TELEBIRR',
        verMethod: 'SMS',
        rawProof: smsText,
      })

      if (result.status !== 'SUCCESS') {
        return { success: false, error: result.reason || 'Verification failed. Receipt may be invalid.' }
      }

      const receipt = result.receipt

      const amount = parseFloat(receipt.amount)
      if (isNaN(amount) || amount <= 0) {
        return { success: false, error: 'Invalid amount on receipt.' }
      }

      const OUR_NAME = 'Alemayehu Tseganew'
      if (receipt.receiverName && !receipt.receiverName.toLowerCase().includes(OUR_NAME.toLowerCase())) {
        return { success: false, error: 'This receipt was not sent to our platform account.' }
      }

      return {
        success: true,
        amount: amount,
        payerName: receipt.senderName || 'Unknown',
        transactionId: receipt.transactionNumber,
        status: 'Completed'
      }
    } catch (err) {
      console.error('Telebirr verification error:', err.message)
      return { success: false, error: 'Unable to reach verification service. Please try again later.' }
    }
  }

  // Otherwise treat as a reference/transaction ID and fetch the receipt directly
  try {
    const url = `https://transactioninfo.ethiotelecom.et/receipt/${smsText}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      return { success: false, error: 'Receipt not found on Telebirr servers.' }
    }

    const html = await response.text()

    const amountMatch = html.match(/(?:paid|transferred|Amount)[^\d]*([0-9]+\.[0-9]{2})/i)
    const trueAmount = amountMatch ? parseFloat(amountMatch[1]) : null

    const receiverMatch = html.match(/(?:to|Credited Party)[^A-Z]*([A-Z][A-Za-z ]+)/i)
    const trueReceiver = receiverMatch ? receiverMatch[1].trim() : null

    const statusMatch = html.match(/(?:status|Status)[^\w]*(Completed|Success|Pending|Failed)/i)
    const status = statusMatch ? statusMatch[1] : 'Unknown'

    if (!trueAmount) {
      return { success: false, error: 'Could not verify amount from Telebirr.' }
    }

    if (status !== 'Completed' && status !== 'Success') {
      return { success: false, error: `Transaction status is ${status}, not completed.` }
    }

    const OUR_NAME = 'Alemayehu'
    if (trueReceiver && !trueReceiver.toLowerCase().includes(OUR_NAME.toLowerCase())) {
      return { success: false, error: 'This receipt was not sent to our platform account.' }
    }

    return {
      success: true,
      amount: trueAmount,
      payerName: 'Unknown',
      transactionId: smsText,
      status: status
    }
  } catch (err) {
    console.error('Telebirr verification error:', err.message)
    return { success: false, error: 'Unable to reach Telebirr servers. Please try again or contact support.' }
  }
}

module.exports = { verifyTelebirrReceipt, processDeposit, parseTelebirrSMS }
