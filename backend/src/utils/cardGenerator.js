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

  // 1. Generate unique numbers for each column
  const cols = ranges.map((range) => getUniqueNumbers(range[0], range[1], 5));

  // 2. Build rows
  for (let i = 0; i < 5; i += 1) {
    const row = [];
    for (let j = 0; j < 5; j += 1) {
      row.push(cols[j][i]);
    }
    card.push(row);
  }

  // 3. Set the FREE space in the exact center (Row 2, Col 2)
  card[2][2] = 'FREE';

  return card;
}

function generateCardPool(size = 400) {
  const pool = [];
  const uniqueCards = new Set();

  while (pool.length < size) {
    const card = generateSingleCard();
    const cardString = JSON.stringify(card);

    if (!uniqueCards.has(cardString)) {
      uniqueCards.add(cardString);
      pool.push({ id: pool.length + 1, matrix: card });
    }
  }
  return pool;
}

module.exports = { generateSingleCard, generateCardPool }

