const db = require('../config/db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { sendTicketEmail } = require('../utils/email')
const { generateTicketPDF } = require('../utils/generateTicket')

// ─── LOGIN ─────────────────────────────────────────────
exports.login = (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: 'Wajib isi username & password' })
  }

  db.query(
    'SELECT * FROM admins WHERE username = ?',
    [username],
    async (err, results) => {
      if (err) return res.status(500).json({ message: 'DB error' })
      if (!results.length) return res.status(401).json({ message: 'Invalid login' })

      const admin = results[0]
      const valid = await bcrypt.compare(password, admin.password)

      if (!valid) {
        return res.status(401).json({ message: 'Invalid login' })
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES }
      )

      res.json({ token, username: admin.username })
    }
  )
}

// ─── GET ALL ORDERS ─────────────────────────────────────
exports.getAllOrders = (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit

  let sql = 'SELECT * FROM orders'
  let countSql = 'SELECT COUNT(*) as total FROM orders'
  const params = []
  const conditions = []

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ? OR order_id LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (conditions.length) {
    const where = ' WHERE ' + conditions.join(' AND ')
    sql += where
    countSql += where
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ message: 'Error DB' })

    db.query(sql, [...params, parseInt(limit), parseInt(offset)], (err, orders) => {
      if (err) return res.status(500).json({ message: 'Error DB' })

      res.json({
        orders,
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      })
    })
  })
}

// ─── GET STATS ──────────────────────────────────────────
exports.getStats = (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(status = 'pending') as pending,
      SUM(status = 'uploaded') as uploaded,
      SUM(status = 'verified') as verified,
      SUM(status = 'confirmed') as confirmed
    FROM orders
  `
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: 'Error DB' })
    res.json(result[0])
  })
}

// ─── UPDATE STATUS (FIXED FULL) ────────────────────────
exports.updateStatus = (req, res) => {
  const { status } = req.body
  const orderId = req.params.id

  const allowed = ['pending', 'uploaded', 'verified', 'confirmed']

  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' })
  }

  const updateSql = `
    UPDATE orders 
    SET status = ? 
    WHERE order_id = ?
  `

  db.query(updateSql, [status, orderId], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Gagal update status' })
    }

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    // ─── ONLY VERIFIED TRIGGER EMAIL ───
    if (status === 'verified') {
      const getSql = 'SELECT * FROM orders WHERE order_id = ?'

      db.query(getSql, [orderId], async (err2, rows) => {
        if (err2) {
          console.log('DB ERROR:', err2)
          return
        }

        if (!rows.length) {
          console.log('ORDER NOT FOUND FOR EMAIL')
          return
        }

        const order = rows[0]

        if (!order.email) {
          console.log('EMAIL KOSONG:', order)
          return
        }

        try {
          await sendTicketEmail(order)
          console.log('TICKET EMAIL SENT:', order.email)
        } catch (emailErr) {
          console.log('EMAIL ERROR:', emailErr)
        }
      })
    }

    return res.json({
      message: `Status updated to ${status}`
    })
  })
}

// ─── DELETE ORDER ──────────────────────────────────────
exports.deleteOrder = (req, res) => {
  db.query(
    'DELETE FROM orders WHERE order_id = ?',
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'Gagal delete' })
      if (!result.affectedRows) return res.status(404).json({ message: 'Not found' })

      res.json({ message: 'Deleted' })
    }
  )
}

// ─── GENERATE TICKET PDF (DOWNLOAD MANUAL) ─────────────
exports.downloadTicketPDF = async (req, res) => {
  const orderId = req.params.id
  console.log('📄 [PDF] Mulai generate untuk order:', orderId)

  try {
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID diperlukan' })
    }

    const results = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM orders WHERE order_id = ?', [orderId], (err, results) => {
        if (err) return reject(err)
        resolve(results)
      })
    })

    const order = results[0]
    if (!order) {
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    const filePath = await generateTicketPDF(order)

    res.download(filePath, `ticket-${order.order_id}.pdf`, (err) => {
      if (err) console.error('❌ Download error:', err)
    })

  } catch (error) {
    console.error('💥 Generate PDF GAGAL:', error)
    if (!res.headersSent) {
      res.status(500).json({ message: 'Gagal generate PDF', detail: error.message })
    }
  }
}
exports.resendTicket = async (req, res) => {
  db.query('SELECT * FROM orders WHERE order_id = ?', [req.params.id], async (err, rows) => {
    if (err) return res.status(500).json({ message: 'Error DB' })
    if (rows.length === 0) return res.status(404).json({ message: 'Order tidak ditemukan' })

    const order = rows[0]
    if (!['verified', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ message: 'Tiket hanya bisa dikirim untuk order verified/confirmed' })
    }

    try {
      await sendTicketEmail(order)
      res.json({ message: `Tiket berhasil dikirim ulang ke ${order.email}` })
    } catch (e) {
      console.error('RESEND ERROR:', e.message)
      res.status(500).json({ message: 'Gagal kirim tiket' })
    }
  })
}
// ─── EXPORT CSV (FINANCE) ──────────────────────────────
exports.exportCSV = (req, res) => {
  db.query('SELECT * FROM orders ORDER BY created_at DESC', (err, orders) => {
    if (err) return res.status(500).json({ message: 'Error DB' })

    // sesuaikan dengan id & harga di data/ticketPackages.js
    const priceMap = {
      basic: 50000,
      trio: 120000,
      vip: 200000
    }

    const headers = [
      'order_id',
      'name',
      'email',
      'phone',
      'package_id',
      'price',
      'status',
      'proof_url',
      'created_at',
      'total_income'
    ]

    const rows = orders.map(o => {
      const price = priceMap[o.package_id] || 0

      return {
        order_id: o.order_id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        package_id: o.package_id,
        price: price,
        status: o.status,
        proof_url: o.proof_url || '-',
        created_at: o.created_at,
        total_income: o.status === 'confirmed' ? price : 0
      }
    })

    const csv = [
      headers.join(','),
      ...rows.map(r =>
        headers.map(h =>
          `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=orders-exmasi-finance.csv'
    )

    res.send(csv)
  })
}