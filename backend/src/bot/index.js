const { Telegraf } = require('telegraf')
const db = require('../db')

async function getUserLanguage(telegramId) {
  const user = await db('users').where({ telegram_id: telegramId }).first()
  return user?.language || 'en'
}

async function setUserLanguage(telegramId, lang) {
  await db('users').where({ telegram_id: telegramId }).update({ language: lang })
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

// Force the menu button to show the command list
bot.telegram.setChatMenuButton({
  menu_button: {
    type: 'commands'
  }
}).then(() => {
  console.log('✅ Menu button forced to COMMANDS mode')
}).catch((err) => {
  console.error('❌ Failed to set menu button:', err)
})

// Register the commands list
bot.telegram.setMyCommands([
  { command: 'start', description: 'Restart the bot' },
  { command: 'menu', description: 'Open the main menu' },
  { command: 'play', description: 'Launch the Bingo game' },
  { command: 'balance', description: 'Check your wallet balance' },
  { command: 'help', description: 'How to play the game' }
]).then(() => console.log('✅ Commands registered')).catch(console.error)

function getMainMenu(lang = 'en') {
  const texts = {
    en: { play: '🎮 Play Game', balance: '💰 Check Balance', deposit: '💳 Deposit', withdraw: '💸 Withdraw', room: '🏠 My Room', help: '❓ Help' },
    am: { play: '🎮 ጨዋታ ይጫወቱ', balance: '💰 ቀሪ ሂሳብ ይመልከቱ', deposit: '💳 ገንዘብ ያስገቡ', withdraw: '💸 ገንዘብ ያውጡ', room: '🏠 ክፍሌ', help: '❓ እርዳታ' }
  }
  const t = texts[lang] || texts.en

  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: t.play, web_app: { url: 'https://guatimala.vercel.app' } }],
        [{ text: t.balance, callback_data: 'menu_balance' }, { text: t.deposit, callback_data: 'menu_deposit' }],
        [{ text: t.withdraw, callback_data: 'menu_withdraw' }, { text: t.room, callback_data: 'menu_room' }],
        [{ text: t.help, callback_data: 'menu_help' }]
      ]
    }
  }
}

// /start command
bot.start((ctx) => {
  ctx.reply('Please select your language / እባክዎ ቋንቋ ይምረጡ:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🇬🇧 English', callback_data: 'lang_en' },
          { text: '🇪🇹 አማርኛ', callback_data: 'lang_am' }
        ]
      ]
    }
  })
})

// language selection handlers
bot.action('lang_en', async (ctx) => {
  await ctx.answerCbQuery()
  try { await setUserLanguage(ctx.from.id, 'en') } catch (e) { console.error(e) }
  ctx.reply('Language set to English.', getMainMenu('en'))
})

bot.action('lang_am', async (ctx) => {
  await ctx.answerCbQuery()
  try { await setUserLanguage(ctx.from.id, 'am') } catch (e) { console.error(e) }
  ctx.reply('ቋንቋ ወደ አማርኛ ተቀይሯል።', getMainMenu('am'))
})

// /menu command
bot.command('menu', async (ctx) => {
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am' ? 'ዋና ምናሌ:' : 'Here is the main menu:'
  ctx.reply(msg, getMainMenu(lang))
})

// /play command
bot.command('play', async (ctx) => {
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am' ? 'ጨዋታውን ለመጀመር ከታች ያለውን ቁልፍ ይጫኑ:' : 'Tap the button below to launch the game:'
  const btn = lang === 'am' ? '🎰 ቢንጎ ይጫወቱ' : '🎰 Play Bingo'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app' } }]] } })
})

// /balance command
bot.command('balance', async (ctx) => {
  const lang = await getUserLanguage(ctx.from.id)
  const user = await db('users').where({ telegram_id: ctx.from.id }).first()
  if (user) {
    const msg = lang === 'am'
      ? `💰 የእርስዎ ቀሪ ሂሳብ: ${Number(user.demo_wallet_balance || 0).toFixed(2)} ብር`
      : `💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`
    ctx.reply(msg)
  } else {
    ctx.reply(lang === 'am' ? 'ተጠቃሚ አልተገኘም። እባክዎ መጀመሪያ መተግበሪያውን ይክፈቱ።' : 'User not found. Please open the Mini App first to register.')
  }
})

// /deposit command
bot.command('deposit', async (ctx) => {
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am'
    ? 'ገንዘብ ለማስገባት እባክዎ መተግበሪያውን ይክፈቱ እና ወደ ዋሌት ይሂዱ።'
    : 'To deposit funds, please open the Mini App and go to the Wallet section.'
  const btn = lang === 'am' ? 'ዋሌት ክፈት' : 'Open Wallet'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app/wallet' } }]] } })
})

// /withdraw command
bot.command('withdraw', async (ctx) => {
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am'
    ? 'ገንዘብ ለማውጣት እባክዎ መተግበሪያውን ይክፈቱ እና ወደ ዋሌት ይሂዱ።'
    : 'To withdraw funds, please open the Mini App and navigate to the Wallet section.'
  const btn = lang === 'am' ? 'ዋሌት ክፈት' : 'Open Wallet'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app/wallet' } }]] } })
})

// /help command
bot.command('help', async (ctx) => {
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am'
    ? `📖 *እንዴት መጫወት እንደሚቻል*\n\n1. መተግበሪያውን ይክፈቱ።\n2. ውለታ ይምረጡ (ለምሳሌ 10 ብር)።\n3. ከ400 ካርዶች አንዱን ይምረጡ።\n4. ጨዋታው እስኪጀምር ይጠብቁ።\n5. ቁጥሮች ሲጠሩ በካርድዎ ላይ ይንኩ።\n6. መስመር ወይም 4 ማእዘናት ሲሟሉ ያሸንፋሉ።\n\nመልካም ጨዋታ!`
    : `📖 *How to Play GOBINGO*\n\n1. Open the Mini App.\n2. Select a stake (e.g., 10 Birr).\n3. Choose a card from the 400 available cards.\n4. Wait for the game to start.\n5. Tap the numbers on your card when they are called.\n6. Win by completing a row, column, diagonal, or four corners.\n\nGood luck!`
  ctx.reply(msg, { parse_mode: 'Markdown' })
})

// Handle "Check Balance" button
bot.action('menu_balance', async (ctx) => {
  await ctx.answerCbQuery()
  const lang = await getUserLanguage(ctx.from.id)
  const user = await db('users').where({ telegram_id: ctx.from.id }).first()
  if (user) {
    const msg = lang === 'am'
      ? `💰 የእርስዎ ቀሪ ሂሳብ: ${Number(user.demo_wallet_balance || 0).toFixed(2)} ብር`
      : `💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`
    ctx.reply(msg)
  } else {
    ctx.reply(lang === 'am' ? 'ተጠቃሚ አልተገኘም።' : 'User not found. Please open the Mini App first to register.')
  }
})

// Handle "Deposit" button
bot.action('menu_deposit', async (ctx) => {
  await ctx.answerCbQuery()
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am'
    ? 'ገንዘብ ለማስገባት እባክዎ መተግበሪያውን ይክፈቱ እና ወደ ዋሌት ይሂዱ።'
    : 'To deposit funds, please open the Mini App and go to the Wallet section.'
  const btn = lang === 'am' ? 'ዋሌት ክፈት' : 'Open Wallet'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app/wallet' } }]] } })
})

// Handle "Withdraw" button
bot.action('menu_withdraw', async (ctx) => {
  await ctx.answerCbQuery()
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am'
    ? 'ገንዘብ ለማውጣት እባክዎ መተግበሪያውን ይክፈቱ እና ወደ ዋሌት ይሂዱ።'
    : 'To withdraw funds, please open the Mini App and navigate to the Wallet section.'
  const btn = lang === 'am' ? 'ዋሌት ክፈት' : 'Open Wallet'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app/wallet' } }]] } })
})

// Handle "My Room" button
bot.action('menu_room', async (ctx) => {
  await ctx.answerCbQuery()
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am' ? 'ክፍል ለመቀላቀል መተግበሪያውን ይክፈቱ እና ውለታ ይምረጡ።' : 'To join a room, please open the Mini App and select a stake.'
  const btn = lang === 'am' ? 'ሎቢ ክፈት' : 'Open Lobby'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app' } }]] } })
})

// Handle "Help" button
bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery()
  const lang = await getUserLanguage(ctx.from.id)
  const msg = lang === 'am'
    ? `📖 *እንዴት መጫወት እንደሚቻል*\n\n1. መተግበሪያውን ይክፈቱ።\n2. ውለታ ይምረጡ (ለምሳሌ 10 ብር)።\n3. ከ400 ካርዶች አንዱን ይምረጡ።\n4. ጨዋታው እስኪጀምር ይጠብቁ።\n5. ቁጥሮች ሲጠሩ በካርድዎ ላይ ይንኩ።\n6. መስመር ወይም 4 ማእዘናት ሲሟሉ ያሸንፋሉ።\n\nመልካም ጨዋታ!`
    : `📖 *How to Play GOBINGO*\n\n1. Open the Mini App.\n2. Select a stake (e.g., 10 Birr).\n3. Choose a card from the 400 available cards.\n4. Wait for the game to start.\n5. Tap the numbers on your card when they are called.\n6. Win by completing a row, column, diagonal, or four corners.\n\nGood luck!`
  ctx.reply(msg, { parse_mode: 'Markdown' })
})

function launch() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not set, skipping bot launch')
    return
  }
  bot.launch().then(() => console.log('Telegram bot launched')).catch((e) => console.error('Bot launch error:', e))
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

module.exports = { bot, launch, getMainMenu }
