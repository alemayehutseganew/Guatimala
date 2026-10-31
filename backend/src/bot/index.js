const { Telegraf } = require('telegraf')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

const setMenuButton = async (ctx) => {
  try {
    await ctx.setChatMenuButton({
      type: 'web_app',
      text: '🎰 Play Bingo',
      web_app: {
        url: 'https://guatimala.vercel.app'
      }
    })
    console.log('Menu button set successfully')
  } catch (error) {
    console.error('Failed to set menu button:', error)
  }
}

bot.start(async (ctx) => {
  await setMenuButton(ctx)
  await ctx.reply('Welcome to Ethio Bingo! Tap the button below to play.')
})

// Set globally for all users on launch
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot.telegram.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: '🎰 Play Bingo',
      web_app: { url: 'https://guatimala.vercel.app' }
    }
  }).then(() => console.log('Global menu button set')).catch((e) => console.error('Global menu button error:', e))
}

function launch() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not set, skipping bot launch')
    return
  }
  bot.launch().then(() => console.log('Telegram bot launched')).catch((e) => console.error('Bot launch error:', e))
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

module.exports = { bot, launch, setMenuButton }
