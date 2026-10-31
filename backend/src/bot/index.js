const { Telegraf } = require('telegraf')
const db = require('../db')

async function getUserLanguage(telegramId) {
  const user = await db('users').where({ telegram_id: telegramId }).first()
  return user?.language || null
}

async function setUserLanguage(telegramId, lang) {
  await db('users').where({ telegram_id: telegramId }).update({ language: lang })
}

async function ensureLanguage(ctx, actionCallback) {
  const user = await db('users').where({ telegram_id: ctx.from.id }).first()
  const lang = user?.language
  if (!lang) {
    await ctx.reply('Please select your language / እባክዎ ቋንቋ ይምረጡ:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇬🇧 English', callback_data: `set_lang_en_${actionCallback}` },
            { text: '🇪🇹 አማርኛ', callback_data: `set_lang_am_${actionCallback}` }
          ]
        ]
      }
    })
    return false
  }
  return true
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

bot.telegram.setChatMenuButton({
  menu_button: { type: 'commands' }
}).then(() => console.log('✅ Menu button forced to COMMANDS mode')).catch(console.error)

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
// Action implementations
async function doBalance(ctx, lang) {
  const user = await db('users').where({ telegram_id: ctx.from.id }).first()
  if (user) {
    const msg = lang === 'am'
      ? `💰 የእርስዎ ቀሪ ሂሳብ: ${Number(user.demo_wallet_balance || 0).toFixed(2)} ብር`
      : `💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`
    ctx.reply(msg)
  } else {
    ctx.reply(lang === 'am' ? 'ተጠቃሚ አልተገኘም።' : 'User not found. Please open the Mini App first to register.')
  }
}

async function doDeposit(ctx, lang) {
  const msg = lang === 'am'
    ? 'ገንዘብ ለማስገባት እባክዎ መተግበሪያውን ይክፈቱ እና ወደ ዋሌት ይሂዱ።'
    : 'To deposit funds, please open the Mini App and go to the Wallet section.'
  const btn = lang === 'am' ? 'ዋሌት ክፈት' : 'Open Wallet'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app/wallet' } }]] } })
}

async function doWithdraw(ctx, lang) {
  const msg = lang === 'am'
    ? 'ገንዘብ ለማውጣት እባክዎ መተግበሪያውን ይክፈቱ እና ወደ ዋሌት ይሂዱ።'
    : 'To withdraw funds, please open the Mini App and navigate to the Wallet section.'
  const btn = lang === 'am' ? 'ዋሌት ክፈት' : 'Open Wallet'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app/wallet' } }]] } })
}

async function doHelp(ctx, lang) {
  const msg = lang === 'am'
    ? `📖 *እንዴት መጫወት እንደሚቻል*\n\n1. መተግበሪያውን ይክፈቱ።\n2. ውለታ ይምረጡ (ለምሳሌ 10 ብር)።\n3. ከ400 ካርዶች አንዱን ይምረጡ።\n4. ጨዋታው እስኪጀምር ይጠብቁ።\n5. ቁጥሮች ሲጠሩ በካርድዎ ላይ ይንኩ።\n6. መስመር ወይም 4 ማእዘናት ሲሟሉ ያሸንፋሉ።\n\nመልካም ጨዋታ!`
    : `📖 *How to Play GOBINGO*\n\n1. Open the Mini App.\n2. Select a stake (e.g., 10 Birr).\n3. Choose a card from the 400 available cards.\n4. Wait for the game to start.\n5. Tap the numbers on your card when they are called.\n6. Win by completing a row, column, diagonal, or four corners.\n\nGood luck!`
  ctx.reply(msg, { parse_mode: 'Markdown' })
}

async function doRoom(ctx, lang) {
  const msg = lang === 'am' ? 'ክፍል ለመቀላቀል መተግበሪያውን ይክፈቱ እና ውለታ ይምረጡ።' : 'To join a room, please open the Mini App and select a stake.'
  const btn = lang === 'am' ? 'ሎቢ ክፈት' : 'Open Lobby'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app' } }]] } })
}

async function doPlay(ctx, lang) {
  const msg = lang === 'am' ? 'ጨዋታውን ለመጀመር ከታች ያለውን ቁልፍ ይጫኑ:' : 'Tap the button below to launch the game:'
  const btn = lang === 'am' ? '🎰 ቢንጎ ይጫወቱ' : '🎰 Play Bingo'
  ctx.reply(msg, { reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: 'https://guatimala.vercel.app' } }]] } })
}

async function doMenu(ctx, lang) {
  const msg = lang === 'am' ? 'ዋና ምናሌ:' : 'Here is the main menu:'
  ctx.reply(msg, getMainMenu(lang))
}

// /start
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

// initial language selection
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

// dynamic language selection then execute original action
bot.action(/^set_lang_(en|am)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery()
  const lang = ctx.match[1]
  const originalAction = ctx.match[2]
  try { await setUserLanguage(ctx.from.id, lang) } catch (e) { console.error(e) }
  const msg = lang === 'am' ? 'ቋንቋ ተቀይሯል።' : 'Language set.'
  await ctx.reply(msg)

  if (originalAction === 'balance') await doBalance(ctx, lang)
  else if (originalAction === 'deposit') await doDeposit(ctx, lang)
  else if (originalAction === 'withdraw') await doWithdraw(ctx, lang)
  else if (originalAction === 'help') await doHelp(ctx, lang)
  else if (originalAction === 'room') await doRoom(ctx, lang)
  else if (originalAction === 'play') await doPlay(ctx, lang)
  else if (originalAction === 'menu') await doMenu(ctx, lang)
})

// commands
bot.command('menu', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'menu')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doMenu(ctx, lang)
})

bot.command('play', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'play')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doPlay(ctx, lang)
})

bot.command('balance', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'balance')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doBalance(ctx, lang)
})

bot.command('deposit', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'deposit')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doDeposit(ctx, lang)
})

bot.command('withdraw', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'withdraw')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doWithdraw(ctx, lang)
})

bot.command('help', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'help')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doHelp(ctx, lang)
})

// actions
bot.action('menu_balance', async (ctx) => {
  await ctx.answerCbQuery()
  const hasLang = await ensureLanguage(ctx, 'balance')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doBalance(ctx, lang)
})

bot.action('menu_deposit', async (ctx) => {
  await ctx.answerCbQuery()
  const hasLang = await ensureLanguage(ctx, 'deposit')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doDeposit(ctx, lang)
})

bot.action('menu_withdraw', async (ctx) => {
  await ctx.answerCbQuery()
  const hasLang = await ensureLanguage(ctx, 'withdraw')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doWithdraw(ctx, lang)
})

bot.action('menu_room', async (ctx) => {
  await ctx.answerCbQuery()
  const hasLang = await ensureLanguage(ctx, 'room')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doRoom(ctx, lang)
})

bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery()
  const hasLang = await ensureLanguage(ctx, 'help')
  if (!hasLang) return
  const lang = await getUserLanguage(ctx.from.id) || 'en'
  await doHelp(ctx, lang)
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

