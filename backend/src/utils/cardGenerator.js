function generateSingleCard() {
  const ranges = [
    [1, 15],
    [16, 30],
    [31, 45],
    [46, 60],
    [61, 75],
  ]

  const matrix = Array.from({ length: 5 }, () => Array(5).fill(null))

  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col]
    const nums = new Set()
    while (nums.size < 5) {
      nums.add(Math.floor(Math.random() * (max - min + 1)) + min)
    }
    const arr = [...nums]
    for (let row = 0; row < 5; row++) {
      matrix[row][col] = arr[row]
    }
  }

  // Center square is FREE
  matrix[2][2] = 'FREE'

  return matrix
}

function generateCardPool(count = 400) {
  const pool = []
  const seen = new Set()

  while (pool.length < count) {
    const card = generateSingleCard()
    const key = JSON.stringify(card)
    if (seen.has(key)) continue
    seen.add(key)
    pool.push(card)
  }

  return pool
}

module.exports = { generateSingleCard, generateCardPool }
