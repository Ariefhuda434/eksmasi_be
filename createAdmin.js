const bcrypt = require('bcryptjs')
const db = require('./config/db')

async function createAdmin() {
  const hashed = await bcrypt.hash('admin123', 10)
  
  db.query(
    'INSERT INTO admins (username, password) VALUES (?, ?) ON DUPLICATE KEY UPDATE password = ?',
    ['exmasi_admin', hashed, hashed],
    (err) => {
      if (err) console.error('Error:', err.message)
      else console.log('✓ Admin password berhasil di-set ke: admin123')
      process.exit()
    }
  )
}

createAdmin()
