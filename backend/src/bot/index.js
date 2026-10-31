const { Telegraf } = require('telegraf')
const db = require('../db')

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

// Set the persistent menu button to show the command list with custom text
bot.telegram.setChatMenuButton({
  menu_button: {
    type: 'commands'
  }
}).then(() => {
  console.log('✅ Menu button set to COMMANDS mode successfully')
}).catch((err) => {
  console.error('❌ Failed to set menu button:', err)
})

// Register the commands list
bot.telegram.setMyCommands([
  { command: 'start', description: 'Restart the bot' },
  { command: 'menu', description: 'Open the main menu' },
  { command: 'play', description: 'Launch the Bingo game' },
  { command: 'balance', description: 'Check your wallet balance' },
  { command: 'deposit', description: 'Deposit funds' },
  { command: 'withdraw', description: 'Withdraw funds' },
  { command: 'help', description: 'How to play the game' }
]).then(() => {
  console.log('✅ Bot commands registered successfully')
}).catch((err) => {
  console.error('❌ Failed to register commands:', err)
})

function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Play Game', web_app: { url: 'https://guatimala.vercel.app' } }],
        [
          { text: '💰 Check Balance', callback_data: 'menu_balance' },
          { text: '💳 Deposit', callback_data: 'menu_deposit' }
        ],
        [
          { text: '💸 Withdraw', callback_data: 'menu_withdraw' },
          { text: '🏠 My Room', callback_data: 'menu_room' }
        ],
        [{ text: '❓ Help', callback_data: 'menu_help' }]
      ]
    }
  }
}

// /start command
bot.start((ctx) => {
  ctx.reply('Welcome to GOBINGO! 🎰\nChoose an option from the menu below:', getMainMenu())
})

// /menu command
bot.command('menu', (ctx) => {
  ctx.reply('Here is the main menu:', getMainMenu())
})

// /play command
bot.command('play', (ctx) => {
  ctx.reply('Tap the button below to launch the game:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎰 Play Bingo', web_app: { url: 'https://guatimala.vercel.app' } }]
      ]
    }
  })
})

// /balance command
bot.command('balance', async (ctx) => {
  try {
    const user = await db('users').where({ telegram_id: ctx.from.id }).first()
    if (user) {
      ctx.reply(`💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`)
    } else {
      ctx.reply('User not found. Please open the Mini App first to register.')
    }
  } catch (error) {
    console.error(error)
    ctx.reply('Failed to fetch balance. Please try again later.')
  }
})

// /deposit command
bot.command('deposit', (ctx) => {
  ctx.reply('To deposit funds, please open the Mini App and go to the Wallet section.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open Wallet in App', web_app: { url: 'https://guatimala.vercel.app/wallet' } }]
      ]
    }
  })
})

// /withdraw command
bot.command('withdraw', (ctx) => {
  ctx.reply('To withdraw funds, please open the Mini App and navigate to the Wallet section.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open Wallet in App', web_app: { url: 'https://guatimala.vercel.app/wallet' } }]
      ]
    }
  })
})

// /help command
bot.command('help', (ctx) => {
  ctx.reply(`📖 *How to Play GOBINGO*\n\n1. Open the Mini App.\n2. Select a stake (e.g., 10 Birr).\n3. Choose a card from the 400 available cards.\n4. Wait for the game to start.\n5. Tap the numbers on your card when they are called.\n6. Win by completing a row, column, diagonal, or four corners.\n\nGood luck!`, { parse_mode: 'Markdown' })
})

// Handle "Check Balance" button
bot.action('menu_balance', async (ctx) => {
  await ctx.answerCbQuery()
  try {
    const user = await db('users').where({ telegram_id: ctx.from.id }).first()
    if (user) {
      ctx.reply(`💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`)
    } else {
      ctx.reply('User not found. Please open the Mini App first to register.')
    }
  } catch (error) {
    console.error(error)
    ctx.reply('Failed to fetch balance.')
  }
})

// Handle "Deposit" button
bot.action('menu_deposit', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.reply('To deposit funds, please open the Mini App and go to the Wallet section.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open Wallet in App', web_app: { url: 'https://guatimala.vercel.app/wallet' } }]
      ]
    }
  })
})

// Handle "Withdraw" button
bot.action('menu_withdraw', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.reply('To withdraw funds, please open the Mini App and navigate to the Wallet section.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open Wallet in App', web_app: { url: 'https://guatimala.vercel.app/wallet' } }]
      ]
    }
  })
})

// Handle "My Room" button
bot.action('menu_room', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.reply('To join a room, please open the Mini App and select a stake.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Open Lobby', web_app: { url: 'https://guatimala.vercel.app' } }]
      ]
    }
  })
})

// Handle "Help" button
bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.reply(`📖 *How to Play GOBINGO*\n\n1. Open the Mini App.\n2. Select a stake (e.g., 10 Birr).\n3. Choose a card from the 400 available cards.\n4. Wait for the game to start.\n5. Tap the numbers on your card when they are called.\n6. Win by completing a row, column, diagonal, or four corners.\n\nGood luck!`, { parse_mode: 'Markdown' })
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
