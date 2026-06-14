const multer = require('multer')
const path = require('path')
const Order = require('../models/order.model')
const db = require('../config/db')
const { sendInvoiceEmail, sendTicketEmail } = require('../utils/email')
const { validateOrderInput } = require('../utils/validation')

// ─── Generate Unique Order ID ───────────────────────────────────
function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 5; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
  return `EXM-${date}-${suffix}`
}

// ─── Multer Upload Config ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}-${Date.now()}${path.extname(file.originalname)}`)
  }
})

exports.upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.test(ext))
  }
})

// ─── Create Order ───────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  const { name, email, phone, packageId, note } = req.body

  // ── Validasi input ──
  const errors = validateOrderInput({ name, email, phone })
  if (errors.length > 0) {
    return res.status(400).json({ message: errors[0], errors })
  }

  // ── Sanitasi ──
  const cleanName  = name.trim()
  const cleanEmail = email.trim().toLowerCase()
  const cleanPhone = phone.trim()

  // ── Generate order ID unik ──
  let order_id
  let attempts = 0
  while (true) {
    order_id = generateOrderId()
    try {
      const existing = await Order.findByOrderId(order_id)
      if (!existing) break
      if (++attempts > 10) return res.status(500).json({ message: 'Gagal generate order ID unik' })
    } catch (err) {
      console.error('DB CHECK ERROR:', err)
      return res.status(500).json({ message: 'Error DB saat generate ID' })
    }
  }

  const data = {
    order_id,
    name:       cleanName,
    email:      cleanEmail,
    phone:      cleanPhone,
    package_id: packageId,
    note:       note?.trim() || '',
    status:     'pending'
  }

  Order.create(data, async (err) => {
    if (err) {
      console.error('DB ERROR:', err)
      return res.status(500).json({ message: 'Gagal create order' })
    }

    try {
      await sendInvoiceEmail(data)
      console.log('EMAIL SUCCESS')
    } catch (emailErr) {
      console.error('EMAIL ERROR:', emailErr.message)
    }

    return res.json({ message: 'Order berhasil dibuat', order: data })
  })
}

// ─── Update Status ──────────────────────────────────────────────
exports.updateOrderStatus = (req, res) => {
  const { id } = req.params
  const status = req.body.status?.trim().toLowerCase()

  const allowedStatus = ['pending', 'uploaded', 'verified', 'rejected', 'confirmed']

  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' })
  }

  const updateSql = 'UPDATE orders SET status = ? WHERE order_id = ?'

  db.query(updateSql, [status, id], (err) => {
    if (err) return res.status(500).json({ message: 'Gagal update status', error: err })

    if (status !== 'verified') return res.json({ message: `Status updated to ${status}` })

    db.query('SELECT * FROM orders WHERE order_id = ?', [id], async (err2, result) => {
      if (err2) return res.status(500).json({ message: 'Gagal ambil data order', error: err2 })
      if (result.length === 0) return res.status(404).json({ message: 'Order tidak ditemukan' })

      const order = result[0]
      try {
        await sendTicketEmail(order)
        console.log('TICKET EMAIL SENT')
        return res.json({ message: 'Status verified dan email tiket berhasil dikirim' })
      } catch (emailErr) {
        console.log('TICKET EMAIL ERROR:', emailErr)
        return res.status(500).json({ message: 'Status verified, tapi email tiket gagal', error: emailErr.message })
      }
    })
  })
}

// ─── Get Order ──────────────────────────────────────────────────
exports.getOrder = (req, res) => {
  const sql = 'SELECT * FROM orders WHERE order_id = ?'
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error DB', error: err })
    if (result.length === 0) return res.status(404).json({ message: 'Order tidak ditemukan' })
    res.json(result[0])
  })
}

// ─── Upload Bukti Bayar ─────────────────────────────────────────
exports.uploadProof = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' })

  const filePath = `/uploads/${req.file.filename}`
  const sql = 'UPDATE orders SET proof_url = ?, status = "uploaded" WHERE order_id = ?'
  db.query(sql, [filePath, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Gagal upload' })
    res.json({ message: 'Bukti bayar berhasil diupload', proof_url: filePath })
  })
}