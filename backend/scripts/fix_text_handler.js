const fs = require('fs')
const p = 'C:/Users/alexo/Desktop/File/Code/GO-BINGO/backend/src/bot/index.js'
let c = fs.readFileSync(p, 'utf8')
c = c.replace("bot.on('text', async (ctx) => {\r\n  const state = userStates[ctx.from.id]", "bot.on('text', async (ctx) => {\r\n  try {\r\n  const state = userStates[ctx.from.id]")
const old = "    delete userStates[ctx.from.id]\r\n    return\r\n  }\r\n})\r\n\r\n// Other actions"
const neu = "    delete userStates[ctx.from.id]\r\n    return\r\n  }\r\n  } catch (err) {\r\n    console.error('Text Handler Error:', err)\r\n    ctx.reply('❌ Failed to process your request. Please try again.')\r\n  }\r\n})\r\n\r\n// Other actions"
if (c.includes(old)) {
  c = c.replace(old, neu)
  fs.writeFileSync(p, c)
  console.log('done')
} else {
  console.log('pattern not found')
}
