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
  console.log('✅ Global menu button set successfully');
}).catch((err) => {
  console.error('❌ Failed to set global menu button:', err);
});

bot.start(async (ctx) => {
  await ctx.reply('Welcome to Ethio Bingo! Tap the button below to play.');
});

function launch() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('TELEGRAM_BOT_TOKEN not set, skipping bot launch')
    return
  }
  bot.launch().then(() => console.log('Telegram bot launched')).catch((e) => console.error('Bot launch error:', e))
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

module.exports = { bot, launch }

