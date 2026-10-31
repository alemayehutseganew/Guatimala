const { Telegraf } = require('telegraf')
const db = require('../db')
const { parseTelebirrSMS } = require('../services/paymentService')

const API_BASE = process.env.API_URL || 'http://localhost:3001'
const userStates = {}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN)

bot.telegram.setChatMenuButton({
  menu_button: { type: 'commands' }
}).then(() => console.log('✅ Menu button forced to COMMANDS mode')).catch(console.error)

bot.telegram.setMyCommands([
  { command: 'start', description: 'Restart the bot' },
  { command: 'menu', description: 'Open the main menu' },
  { command: 'play', description: 'Launch the Bingo game' },
  { command: 'balance', description: 'Check your wallet balance' },
  { command: 'deposit', description: 'Deposit funds' },
  { command: 'withdraw', description: 'Withdraw funds' },
  { command: 'help', description: 'How to play the game' }
]).then(() => console.log('✅ Commands registered')).catch(console.error)

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

bot.action('lang_en', async (ctx) => {
  await ctx.answerCbQuery()
  try { await db('users').where({ telegram_id: ctx.from.id }).update({ language: 'en' }) } catch (e) { console.error(e) }
  ctx.reply('Language set to English.', getMainMenu())
})

bot.action('lang_am', async (ctx) => {
  await ctx.answerCbQuery()
  try { await db('users').where({ telegram_id: ctx.from.id }).update({ language: 'am' }) } catch (e) { console.error(e) }
  ctx.reply('ቋንቋ ወደ አማርኛ ተቀይሯል።', getMainMenu())
})

bot.command('menu', (ctx) => ctx.reply('Here is the main menu:', getMainMenu()))
bot.command('play', (ctx) => ctx.reply('Tap the button below to launch the game:', {
  reply_markup: { inline_keyboard: [[{ text: '🎰 Play Bingo', web_app: { url: 'https://guatimala.vercel.app' } }]] }
}))
bot.command('balance', async (ctx) => {
  const user = await db('users').where({ telegram_id: ctx.from.id }).first()
  if (user) ctx.reply(`💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`)
  else ctx.reply('User not found. Please open the Mini App first to register.')
})
bot.command('help', (ctx) => ctx.reply('📖 How to Play GOBINGO\n\n1. Open the Mini App.\n2. Select a stake.\n3. Choose a card.\n4. Wait for game start.\n5. Tap numbers when called.\n6. Complete a line and press BINGO!\n\nGood luck!', { parse_mode: 'Markdown' }))
// Deposit flow
bot.command('deposit', (ctx) => {
  userStates[ctx.from.id] = 'WAITING_FOR_RECEIPT'
  ctx.reply('Please send the entire SMS text you received from Telebirr (or the Transaction ID).')
})
bot.action('menu_deposit', async (ctx) => {
  await ctx.answerCbQuery()
  userStates[ctx.from.id] = 'WAITING_FOR_RECEIPT'
  ctx.reply('Please send the entire SMS text you received from Telebirr (or the Transaction ID).')
})

// Withdraw flow
bot.command('withdraw', (ctx) => {
  userStates[ctx.from.id] = 'WAITING_FOR_WITHDRAW_AMOUNT'
  ctx.reply('Enter the amount you want to withdraw (Minimum 100 ETB):')
})
bot.action('menu_withdraw', async (ctx) => {
  await ctx.answerCbQuery()
  userStates[ctx.from.id] = 'WAITING_FOR_WITHDRAW_AMOUNT'
  ctx.reply('Enter the amount you want to withdraw (Minimum 100 ETB):')
})

// Text handler for flows
bot.on('text', async (ctx) => {
  const state = userStates[ctx.from.id]
  if (!state) return

  if (state === 'WAITING_FOR_RECEIPT') {
    const smsText = ctx.message.text
    const parsedData = parseTelebirrSMS(smsText)
    if (!parsedData) {
      return ctx.reply('Invalid receipt format. Please copy the whole SMS from Telebirr.')
    }
    try {
      const res = await fetch(`${API_BASE}/api/wallet/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ctx.from.id, amount: parsedData.amount, reference: parsedData.transactionId }),
      })
      const data = await res.json()
      if (data.success) {
        ctx.reply(`✅ Deposit of ETB ${parsedData.amount} successful! Your new balance is ETB ${data.newBalance}.`)
      } else {
        ctx.reply(`❌ ${data.error || 'Verification failed'}`)
      }
    } catch (e) {
      ctx.reply('❌ Network error')
    }
    delete userStates[ctx.from.id]
    return
  }

  if (state === 'WAITING_FOR_WITHDRAW_AMOUNT') {
    const amount = Number(ctx.message.text)
    if (isNaN(amount) || amount < 100) {
      return ctx.reply('Invalid amount. Minimum withdrawal is 100 ETB.')
    }
    try {
      const res = await fetch(`${API_BASE}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ctx.from.id, amount, provider: 'telebirr', phoneNumber: '' }),
      })
      const data = await res.json()
      if (data.success) {
        ctx.reply(`✅ Withdrawal request for ETB ${amount} received. Our team will process it shortly.`)
      } else {
        ctx.reply(`❌ ${data.error || 'Failed'}`)
      }
    } catch (e) {
      ctx.reply('❌ Network error')
    }
    delete userStates[ctx.from.id]
    return
  }
})

// Other actions
bot.action('menu_balance', async (ctx) => {
  await ctx.answerCbQuery()
  const user = await db('users').where({ telegram_id: ctx.from.id }).first()
  if (user) ctx.reply(`💰 Your current balance is: ETB ${Number(user.demo_wallet_balance || 0).toFixed(2)}`)
  else ctx.reply('User not found. Please open the Mini App first to register.')
})
bot.action('menu_room', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.reply('To join a room, please open the Mini App and select a stake.', {
    reply_markup: { inline_keyboard: [[{ text: 'Open Lobby', web_app: { url: 'https://guatimala.vercel.app' } }]] }
  })
})
bot.action('menu_help', async (ctx) => {
  await ctx.answerCbQuery()
  ctx.reply('📖 How to Play GOBINGO\n\n1. Open the Mini App.\n2. Select a stake.\n3. Choose a card.\n4. Wait for game start.\n5. Tap numbers when called.\n6. Complete a line and press BINGO!\n\nGood luck!', { parse_mode: 'Markdown' })
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
