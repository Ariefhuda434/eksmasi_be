const db = require('../config/db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { sendTicketEmail } = require('../utils/email')
const { generateTicketPDF } = require('../utils/generateTicket')

// ─── PACKAGE PRICE MAP ─────────────────────────────────
// Pastikan ini sama dengan data/ticketPackages.js di frontend
const PRICE_MAP = {
  basic: 50000,
  trio: 120000,
  vip: 200000
}

const getPackagePrice = (packageId) => {
  return PRICE_MAP[packageId] || 0
}

// SQL CASE untuk hitung revenue langsung dari DB
const REVENUE_CASE_SQL = `
  CASE 
    WHEN status = 'confirmed' AND package_id = 'basic' THEN 50000
    WHEN status = 'confirmed' AND package_id = 'trio' THEN 120000
    WHEN status = 'confirmed' AND package_id = 'vip' THEN 200000
    ELSE 0
  END
`

// ─── LOGIN ─────────────────────────────────────────────
exports.login = async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: 'Username dan password wajib diisi' })
  }

  db.query(
    'SELECT * FROM admins WHERE username = ?',
    [username],
    async (err, results) => {
      if (err) {
        console.error('DB LOGIN ERROR:', err.message, err.code)
        return res.status(500).json({ message: 'DB error', detail: err.message })
      }

      if (results.length === 0) {
        return res.status(401).json({ message: 'Kredensial salah' })
      }

      const admin = results[0]
      const valid = await bcrypt.compare(password, admin.password)

      if (!valid) {
        return res.status(401).json({ message: 'Kredensial salah' })
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '1d' }
      )

      res.json({
        token,
        username: admin.username
      })
    }
  )
}

// ─── GET ALL ORDERS ─────────────────────────────────────
exports.getAllOrders = (req, res) => {
  const { status, search } = req.query

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)
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
    if (err) {
      console.error('GET ORDERS COUNT ERROR:', err)
      return res.status(500).json({ message: 'Error DB' })
    }

    const total = countResult[0]?.total || 0

    db.query(sql, [...params, limit, offset], (err, orders) => {
      if (err) {
        console.error('GET ORDERS ERROR:', err)
        return res.status(500).json({ message: 'Error DB' })
      }

      res.json({
        orders,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      })
    })
  })
}

// ─── GET STATS + REVENUE ────────────────────────────────
exports.getStats = (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(status = 'pending'), 0) as pending,
      COALESCE(SUM(status = 'uploaded'), 0) as uploaded,
      COALESCE(SUM(status = 'verified'), 0) as verified,
      COALESCE(SUM(status = 'confirmed'), 0) as confirmed,
      COALESCE(SUM(${REVENUE_CASE_SQL}), 0) as total_revenue
    FROM orders
  `

  db.query(sql, (err, result) => {
    if (err) {
      console.error('GET STATS ERROR:', err)
      return res.status(500).json({ message: 'Error DB' })
    }

    const row = result[0] || {}

    res.json({
      total: Number(row.total || 0),
      pending: Number(row.pending || 0),
      uploaded: Number(row.uploaded || 0),
      verified: Number(row.verified || 0),
      confirmed: Number(row.confirmed || 0),
      total_revenue: Number(row.total_revenue || 0)
    })
  })
}

// ─── UPDATE STATUS ──────────────────────────────────────
exports.updateStatus = (req, res) => {
  const { status } = req.body
  const orderId = req.params.id

  const allowed = ['pending', 'uploaded', 'verified', 'confirmed']

  if (!orderId) {
    return res.status(400).json({ message: 'Order ID diperlukan' })
  }

  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' })
  }

  // Ambil order dulu supaya bisa cek status lama dan data email
  db.query('SELECT * FROM orders WHERE order_id = ?', [orderId], (err, rows) => {
    if (err) {
      console.error('GET ORDER BEFORE UPDATE ERROR:', err)
      return res.status(500).json({ message: 'Error DB' })
    }

    if (!rows.length) {
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    const oldOrder = rows[0]
    const oldStatus = oldOrder.status

    const updateSql = `
      UPDATE orders 
      SET status = ? 
      WHERE order_id = ?
    `

    db.query(updateSql, [status, orderId], (err2, result) => {
      if (err2) {
        console.error('UPDATE STATUS ERROR:', err2)
        return res.status(500).json({ message: 'Gagal update status' })
      }

      if (!result.affectedRows) {
        return res.status(404).json({ message: 'Order tidak ditemukan' })
      }

      // Kirim email tiket hanya saat status berubah ke verified
      // Jadi kalau API ke-hit ulang dengan status verified, email tidak dobel
      if (status === 'verified' && oldStatus !== 'verified') {
        const orderForEmail = {
          ...oldOrder,
          status: 'verified'
        }

        if (!orderForEmail.email) {
          console.log('EMAIL KOSONG:', orderForEmail)
        } else {
          sendTicketEmail(orderForEmail)
            .then(() => {
              console.log('TICKET EMAIL SENT:', orderForEmail.email)
            })
            .catch((emailErr) => {
              console.log('EMAIL ERROR:', emailErr)
            })
        }
      }

      return res.json({
        message: `Status updated to ${status}`
      })
    })
  })
}

// ─── DELETE ORDER ──────────────────────────────────────
exports.deleteOrder = (req, res) => {
  const orderId = req.params.id

  if (!orderId) {
    return res.status(400).json({ message: 'Order ID diperlukan' })
  }

  db.query(
    'DELETE FROM orders WHERE order_id = ?',
    [orderId],
    (err, result) => {
      if (err) {
        console.error('DELETE ORDER ERROR:', err)
        return res.status(500).json({ message: 'Gagal delete' })
      }

      if (!result.affectedRows) {
        return res.status(404).json({ message: 'Not found' })
      }

      res.json({ message: 'Deleted' })
    }
  )
}

// ─── GENERATE TICKET PDF DOWNLOAD MANUAL ────────────────
exports.downloadTicketPDF = async (req, res) => {
  const orderId = req.params.id
  console.log('📄 [PDF] Mulai generate untuk order:', orderId)

  try {
    if (!orderId) {
      return res.status(400).json({ message: 'Order ID diperlukan' })
    }

    const results = await new Promise((resolve, reject) => {
      db.query(
        'SELECT * FROM orders WHERE order_id = ?',
        [orderId],
        (err, results) => {
          if (err) return reject(err)
          resolve(results)
        }
      )
    })

    const order = results[0]

    if (!order) {
      return res.status(404).json({ message: 'Order tidak ditemukan' })
    }

    const filePath = await generateTicketPDF(order)

    res.download(filePath, `ticket-${order.order_id}.pdf`, (err) => {
      if (err) {
        console.error('❌ Download error:', err)
      }
    })
  } catch (error) {
    console.error('💥 Generate PDF GAGAL:', error)

    if (!res.headersSent) {
      res.status(500).json({
        message: 'Gagal generate PDF',
        detail: error.message
      })
    }
  }
}

// ─── RESEND TICKET EMAIL ────────────────────────────────
exports.resendTicket = async (req, res) => {
  const orderId = req.params.id

  if (!orderId) {
    return res.status(400).json({ message: 'Order ID diperlukan' })
  }

  db.query(
    'SELECT * FROM orders WHERE order_id = ?',
    [orderId],
    async (err, rows) => {
      if (err) {
        console.error('RESEND GET ORDER ERROR:', err)
        return res.status(500).json({ message: 'Error DB' })
      }

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Order tidak ditemukan' })
      }

      const order = rows[0]

      if (!['verified', 'confirmed'].includes(order.status)) {
        return res.status(400).json({
          message: 'Tiket hanya bisa dikirim untuk order verified/confirmed'
        })
      }

      if (!order.email) {
        return res.status(400).json({
          message: 'Email order kosong'
        })
      }

      try {
        await sendTicketEmail(order)

        res.json({
          message: `Tiket berhasil dikirim ulang ke ${order.email}`
        })
      } catch (e) {
        console.error('RESEND ERROR:', e.message)

        res.status(500).json({
          message: 'Gagal kirim tiket'
        })
      }
    }
  )
}

// ─── EXPORT CSV FINANCE ─────────────────────────────────
exports.exportCSV = (req, res) => {
  db.query(
    'SELECT * FROM orders ORDER BY created_at DESC',
    (err, orders) => {
      if (err) {
        console.error('EXPORT CSV ERROR:', err)
        return res.status(500).json({ message: 'Error DB' })
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

      const rows = orders.map((o) => {
        const price = getPackagePrice(o.package_id)

        return {
          order_id: o.order_id,
          name: o.name,
          email: o.email,
          phone: o.phone,
          package_id: o.package_id,
          price,
          status: o.status,
          proof_url: o.proof_url || '-',
          created_at: o.created_at,
          total_income: o.status === 'confirmed' ? price : 0
        }
      })

      const csv = [
        headers.join(','),
        ...rows.map((r) =>
          headers.map((h) =>
            `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`
          ).join(',')
        )
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=orders-exmasi-finance.csv'
      )

      res.send(csv)
    }
  )
}