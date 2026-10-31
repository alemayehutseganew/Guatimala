const { Telegraf } = require('telegraf')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

// Set the global menu button for all users on bot launch
bot.telegram.setChatMenuButton({
  menu_button: {
    type: 'web_app',
    text: '☰ Menu',
    web_app: { url: 'https://guatimala.vercel.app' }
  }
}).then(() => {
  console.log('✅ Global menu button set successfully')
}).catch((err) => {
  console.error('❌ Failed to set global menu button:', err)
})

function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🎮 Play Game', web_app: { url: 'https://guatimala.vercel.app' } }
        ],
        [
          { text: '💰 Check Balance', callback_data: 'menu_balance' },
          { text: '💳 Deposit', callback_data: 'menu_deposit' }
        ],
        [
          { text: '🏠 My Room', callback_data: 'menu_room' },
          { text: '❓ Help', callback_data: 'menu_help' }
        ]
      ]
    }
  }
}

bot.start(async (ctx) => {
  await ctx.reply('Welcome to Ethio Bingo! Tap a button below to get started.', getMainMenu())
})

bot.action('menu_balance', async (ctx) => {
  await ctx.answerCbQuery()
  const userId = ctx.from.id
  await ctx.reply(`Your balance is available in the Mini App. (Telegram ID: ${userId})`, getMainMenu())
})

bot.action('menu_deposit', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply('To deposit, open the Mini App and use the Wallet page.', getMainMenu())
})

bot.action('menu_room', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply('Your room info is available in the Mini App.', getMainMenu())
})

bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply(
    'Ethio Bingo Help:\n\n1. Choose a stake.\n2. Select up to 2 cards.\n3. Numbers are called automatically.\n4. Tap called numbers on your card to mark them.\n5. Complete a line or 4 corners and press BINGO!',
    getMainMenu()
  )
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
