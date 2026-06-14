const cron = require('node-cron')
const db = require('../config/db')

function startCleanupCron() {
  // Jalan setiap jam, di menit ke-0
  cron.schedule('0 * * * *', () => {
    const sql = `
      DELETE FROM orders
      WHERE status = 'pending'
        AND (proof_url IS NULL OR proof_url = '')
        AND created_at < (NOW() - INTERVAL 24 HOUR)
    `

    db.query(sql, (err, result) => {
      if (err) {
        console.error('[CLEANUP] Gagal hapus order pending kadaluarsa:', err)
        return
      }
      if (result.affectedRows > 0) {
        console.log(`[CLEANUP] ${result.affectedRows} order pending tanpa bukti (>24 jam) dihapus`)
      }
    })
  })

  console.log('[CLEANUP] Cron job auto-cleanup order pending aktif (jalan setiap jam)')
}

module.exports = { startCleanupCron }