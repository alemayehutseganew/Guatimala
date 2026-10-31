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
  if (user) ctx.reply(`💰 Your current balance is: ETB ${Number(user.wallet_balance || 0).toFixed(2)}`)
  else ctx.reply('User not found. Please open the Mini App first to register.')
})
bot.command('help', (ctx) => ctx.reply('📖 How to Play GOBINGO\n\n1. Open the Mini App.\n2. Select a stake.\n3. Choose a card.\n4. Wait for game start.\n5. Tap numbers when called.\n6. Complete a line and press BINGO!\n\nGood luck!', { parse_mode: 'Markdown' }))
// Deposit flow
bot.command('deposit', async (ctx) => {
  const hasLang = await ensureLanguage(ctx, 'deposit')
  if (!hasLang) return
  userStates[ctx.from.id] = 'WAITING_FOR_RECEIPT'
  ctx.reply('💳 *To Deposit:*\n\n👤 *Name:* Alemayehu Tseganew\n📱 *Telebirr:* 0963184624\n\n1. Open your Telebirr app\n2. Send money to the number above\n3. Copy the SMS you receive\n\n👇 Now paste the full SMS here:', { parse_mode: 'Markdown' })
})

bot.action('menu_deposit', async (ctx) => {
  try {
    await ctx.answerCbQuery()

    userStates[ctx.from.id] = 'WAITING_FOR_RECEIPT'

    const msg = `💳 To Deposit:\n\n` +
      `👤 Name: Alemayehu Tseganew\n` +
      `📱 Telebirr: 0963184624\n\n` +
      `1. Open your Telebirr app\n` +
      `2. Send money to the number above\n` +
      `3. Copy the SMS you receive\n\n` +
      `👇 Now paste the full SMS here:`

    ctx.reply(msg)
  } catch (err) {
    console.error('Deposit Error:', err)
    ctx.reply('❌ An error occurred. Please try again.')
  }
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
  try {
  const state = userStates[ctx.from.id]
  if (!state) return

  if (state === 'WAITING_FOR_RECEIPT') {
    const smsText = ctx.message.text
    const parsedData = parseTelebirrSMS(smsText)

    if (!parsedData) {
      return ctx.reply('❌ Invalid receipt format. Please copy the entire SMS you received from Telebirr and paste it here.')
    }

    try {
      const existingPayment = await db('payments').where({ transaction_reference: parsedData.transactionId }).first()
      if (existingPayment) {
        return ctx.reply('❌ This Telebirr receipt has already been used.')
      }

      const user = await db('users').where({ telegram_id: ctx.from.id }).first()
      if (!user) {
        return ctx.reply('❌ User not found. Please open the Mini App first to register.')
      }

      await db.transaction(async (trx) => {
        await trx('payments').insert({
          user_id: user.id,
          amount: parsedData.amount,
          transaction_reference: parsedData.transactionId,
          provider: 'telebirr',
          status: 'completed',
          type: 'deposit',
          provider_response: { payerName: parsedData.payerName },
        })

        await trx('users').where({ id: user.id }).increment('wallet_balance', parsedData.amount)

        const hasLedger = await trx.schema.hasTable('financial_ledger')
        if (hasLedger) {
          await trx('financial_ledger').insert({
            user_id: user.id,
            amount: parsedData.amount,
            type: 'DEPOSIT',
            reference: parsedData.transactionId,
            created_at: new Date(),
          })
        }
      })

      const updatedUser = await db('users').where({ id: user.id }).first()
      ctx.reply(`✅ Deposit of ETB ${Number(parsedData.amount).toFixed(2)} successful!\n\nYour new balance is ETB ${Number(updatedUser.wallet_balance).toFixed(2)}.`)
    } catch (err) {
      console.error('Bot Deposit Error:', err)
      ctx.reply('❌ An error occurred while processing your deposit. Please try again later.')
    }

    delete userStates[ctx.from.id]
    return
  }

  if (state === 'WAITING_FOR_WITHDRAW_AMOUNT') {
    const amount = Number(ctx.message.text)

    if (isNaN(amount) || amount < 100) {
      return ctx.reply('❌ Invalid amount. Minimum withdrawal is 100 ETB.')
    }

    try {
      const user = await db('users').where({ telegram_id: ctx.from.id }).first()
      if (!user) {
        return ctx.reply('❌ User not found.')
      }

      if (Number(user.wallet_balance) < amount) {
        return ctx.reply('❌ Insufficient real balance. You only have ETB ' + user.wallet_balance + '.')
      }

      const pending = await db('payments').where({ user_id: user.id, type: 'withdrawal', status: 'pending' }).first()
      if (pending) {
        return ctx.reply('❌ You already have a pending withdrawal request. Please wait for it to be processed.')
      }

      await db.transaction(async (trx) => {
        await trx('users').where({ id: user.id }).decrement('wallet_balance', amount)

        await trx('payments').insert({
          user_id: user.id,
          amount: amount,
          provider: 'telebirr',
          status: 'pending',
          type: 'withdrawal',
          transaction_reference: `WD-${Date.now()}-${user.id}`,
        })

        const hasLedger = await trx.schema.hasTable('financial_ledger')
        if (hasLedger) {
          await trx('financial_ledger').insert({
            user_id: user.id,
            amount: -amount,
            type: 'WITHDRAWAL',
            reference: 'PENDING',
            created_at: new Date(),
          })
        }
      })

      const updatedUser = await db('users').where({ id: user.id }).first()
      ctx.reply(`✅ Withdrawal request for ETB ${amount.toFixed(2)} submitted successfully!\n\nYour remaining balance is ETB ${Number(updatedUser.wallet_balance).toFixed(2)}. Our admin team will process the payment shortly.`)
    } catch (err) {
      console.error('Bot Withdraw Error:', err)
      ctx.reply('❌ An error occurred while processing your withdrawal. Please try again later.')
    }

    delete userStates[ctx.from.id]
    return
  }
  } catch (err) {
    console.error('Text Handler Error:', err)
    ctx.reply('❌ Failed to process your request. Please try again.')
  }
})

// Other actions
bot.action('menu_balance', async (ctx) => {
  try {
    await ctx.answerCbQuery()
    const user = await db('users').where({ telegram_id: ctx.from.id }).first()

    if (!user) {
      return ctx.reply('User not found. Please open the Mini App first to register.')
    }

    const balance = user.wallet_balance || 0
    ctx.reply(`💰 Your current balance is: ETB ${Number(balance).toFixed(2)}`)
  } catch (err) {
    console.error('Balance Error:', err)
    ctx.reply('❌ Failed to fetch balance. Please try again later.')
  }
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

bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err)
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
