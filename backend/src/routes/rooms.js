const express = require('express')
const router = express.Router()

function generateCardMatrix(cardNumber) {
  // Deterministic-ish bingo card based on card number
  const seed = cardNumber
  const rand = (min, max, i) => {
    // simple pseudo-random
    const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 10000
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min
  }

  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ]

  const matrix = []
  for (let row = 0; row < 5; row++) {
    const r = []
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        r.push(0) // FREE
      } else {
        const [min, max] = ranges[col]
        r.push(rand(min, max, row * 5 + col))
      }
    }
    matrix.push(r)
  }
  return matrix
}

// GET /api/rooms/:roomId/cards
router.get('/:roomId/cards', (req, res) => {
  const cards = []
  for (let i = 1; i <= 400; i++) {
    cards.push({
      id: i,
      card_number: i,
      taken: false,
      matrix: generateCardMatrix(i),
    })
  }
  res.json(cards)
})

module.exports = router
