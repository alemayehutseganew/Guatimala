function parseTelebirrSMS(smsText) {
  if (!smsText || typeof smsText !== 'string') return null

  const txnMatch = smsText.match(/Your transaction number is ([A-Z0-9]+)/i)
  const amountMatch = smsText.match(/You have paid ETB ([0-9.]+)/i)
  const payerMatch = smsText.match(/- ([A-Za-z ]+?) on /i)
  const phoneMatch = smsText.match(/from ([0-9]+)/i)

  if (!txnMatch || !amountMatch) return null

  return {
    transactionId: txnMatch[1],
    amount: parseFloat(amountMatch[1]),
    payerName: payerMatch ? payerMatch[1].trim() : null,
    phoneNumber: phoneMatch ? phoneMatch[1] : null,
  }
}

module.exports = { parseTelebirrSMS }
