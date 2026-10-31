require('dotenv').config()

const express = require('express')
const cors = require('cors')
const http = require('http')
const authRoutes = require('./routes/auth')
const roomRoutes = require('./routes/rooms')
const paymentsRoutes = require('./routes/payments')
const walletRoutes = require('./routes/wallet')
const usersRoutes = require('./routes/users')
const adminRoutes = require('./routes/admin')
const { setupSocket } = require('./sockets/gameHandler')
const { launch: launchBot } = require('./bot')

const app = express()

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://guatimala.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data']
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/admin', adminRoutes)

const server = http.createServer(app)
const io = setupSocket(server)

// Optional Redis adapter for horizontal scaling
if (process.env.REDIS_URL) {
  try {
    const { createAdapter } = require('@socket.io/redis-adapter')
    const { createClient } = require('redis')
    const pubClient = createClient({ url: process.env.REDIS_URL })
    const subClient = pubClient.duplicate()
    Promise.all([pubClient.connect(), subClient.connect()])
      .then(() => {
        io.adapter(createAdapter(pubClient, subClient))
        console.log('✅ Redis adapter connected for Socket.io scaling')
      })
      .catch((err) => console.error('Redis adapter error:', err))
  } catch (err) {
    console.log('⚠️ Redis packages not installed. Using in-memory adapter.')
  }
} else {
  console.log('⚠️ REDIS_URL not set. Using in-memory Socket.io adapter.')
}

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  launchBot()
})

module.exports = { app, server }
