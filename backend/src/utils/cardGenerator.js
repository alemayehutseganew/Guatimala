function getUniqueNumbers(min, max, count) {
  const nums = new Set();
  while (nums.size < count) {
    nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(nums);
}

function generateSingleCard() {
  const card = [];
  const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];

  // Generate unique columns
  const cols = ranges.map((range) => getUniqueNumbers(range[0], range[1], 5));

  // Build rows
  for (let i = 0; i < 5; i += 1) {
    const row = [];
    for (let j = 0; j < 5; j += 1) {
      row.push(cols[j][i]);
    }
    card.push(row);
  }

  // Set FREE space
  card[2][2] = 'FREE';

  return card;
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

module.exports = { generateSingleCard, generateCardPool, getUniqueNumbers }
