const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const orderRoutes = require('./routes/order.routes')
const adminRoutes = require('./routes/admin.routes')

const app = express()
app.set('trust proxy', 1)
app.set('trust proxy', 1)
// ─── Security Headers ───────────────────────────────────────────
app.use(helmet())

// ─── CORS ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

app.use(express.json())
app.use('/uploads', express.static('uploads'))

// ─── Rate Limiters ──────────────────────────────────────────────
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Terlalu banyak percobaan order. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── Routes (limiter SEBELUM route) ────────────────────────────
app.use('/api/orders', orderLimiter)
app.use('/api/admin/login', loginLimiter)
app.use('/api', orderRoutes)
app.use('/api/admin', adminRoutes)

app.listen(5000, () => {
  console.log('Server running on port 5000')
})