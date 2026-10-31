function calculatePayout(totalPlayers, stake, platformFeePercent = 10) {
  const prizePool = totalPlayers * stake
  const platformFee = (prizePool * platformFeePercent) / 100
  const payout = prizePool - platformFee
  return { prizePool, platformFee, payout }
}

module.exports = { calculatePayout }
