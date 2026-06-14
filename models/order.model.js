const db = require('../config/db')

const Order = {
  create: (data, cb) => {
    const sql = `
      INSERT INTO orders (order_id, name, email, phone, package_id, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    db.query(sql, [
      data.order_id,
      data.name,
      data.email,
      data.phone,
      data.package_id,
      data.note,
      data.status
    ], cb)
  },

  findById: (order_id, cb) => {
    db.query('SELECT * FROM orders WHERE order_id = ?', [order_id], cb)
  },

  // ← TAMBAH INI
  findByOrderId: (order_id) => {
    return new Promise((resolve, reject) => {
      db.query(
        'SELECT id FROM orders WHERE order_id = ? LIMIT 1',
        [order_id],
        (err, results) => {
          if (err) return reject(err)
          resolve(results[0] || null)
        }
      )
    })
  }
}

module.exports = Order