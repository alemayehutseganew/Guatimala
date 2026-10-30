require('dotenv').config()

const express = require('express')
const cors = require('cors')
const http = require('http')
const authRoutes = require('./routes/auth')
const roomRoutes = require('./routes/rooms')
const paymentsRoutes = require('./routes/payments')
const { setupSocket } = require('./sockets/gameHandler')

const app = express()

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'x-dev-user'],
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/payments', paymentsRoutes)

const server = http.createServer(app)
setupSocket(server)

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

module.exports = { app, server }
