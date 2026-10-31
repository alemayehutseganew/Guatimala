const db = require('../db')

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

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null
  const status = statusMatch ? statusMatch[1].trim() : 'Completed'
  const payerName = payerMatch ? payerMatch[1].trim() : 'Unknown'

  if (!amount) return null
  return { amount, status, payerName }
}

async function verifyTelebirrReceipt(reference) {
  const text = await fetchReceiptHtml(reference)
  if (!text) return { success: false, error: 'Receipt not found or geo-blocked' }
  const parsed = parseReceipt(text)
  if (!parsed) return { success: false, error: 'Could not parse receipt' }
  if (parsed.status && parsed.status.toLowerCase() !== 'completed') {
    return { success: false, error: 'Transaction not completed' }
  }
  return { success: true, amount: parsed.amount, payerName: parsed.payerName }
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
    await trx('users').where({ id: userId }).increment('demo_wallet_balance', verify.amount)
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
    newBalance = u.demo_wallet_balance
  })

  return { success: true, newBalance }
}

module.exports = { verifyTelebirrReceipt, processDeposit }
