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

async function fetchReceiptHtml(reference) {
  const urls = [
    `https://transactioninfo.ethiotelecom.et/receipt/${reference}`,
    `https://verify.leul.et/api/verify?ref=${reference}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) continue
      const text = await res.text()
      if (text && text.length > 0) return text
    } catch (e) {
      // try next
    }
  }
  return null
}

function parseReceipt(text) {
  try {
    const json = JSON.parse(text)
    if (json && (json.amount || json.total_paid)) {
      return {
        amount: parseFloat(json.amount || json.total_paid),
        status: json.status || json.transaction_status || 'Completed',
        payerName: json.payerName || json.payer_name || json.payer || 'Unknown',
      }
    }
  } catch (e) {
    // not json
  }

  const amountMatch =
    text.match(/(?:Total\s*Paid|Amount|Total Amount)[:\s]*([\d,]+\.?\d*)/i) ||
    text.match(/ETB\s*([\d,]+\.?\d*)/i)
  const statusMatch = text.match(/(?:Status|Transaction Status)[:\s]*([A-Za-z]+)/i)
  const payerMatch =
    text.match(/(?:Payer|Payer Name|Customer)[:\s]*([A-Za-z ]+)/i) ||
    text.match(/Name[:\s]*([A-Za-z ]+)/i)

  const creditedPartyMatch =
    text.match(/(?:to|credited to|receiver|paid to)[:\s]*([0-9]{9,}|[A-Za-z ]+)/i) ||
    text.match(/09[0-9]{8}/)

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null
  const status = statusMatch ? statusMatch[1].trim() : 'Completed'
  const payerName = payerMatch ? payerMatch[1].trim() : 'Unknown'
  const creditedParty = creditedPartyMatch ? creditedPartyMatch[0] : text

  if (!amount) return null
  return { amount, status, payerName, creditedParty }
}

async function verifyTelebirrReceipt(reference) {
  try {
    const url = `https://transactioninfo.ethiotelecom.et/receipt/${reference}`
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
      receiver: trueReceiver,
      status: status,
      officialReceipt: true
    }
  } catch (err) {
    console.error('Telebirr verification error:', err.message)
    return { success: false, error: 'Unable to reach Telebirr servers. Please try again or contact support.' }
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
