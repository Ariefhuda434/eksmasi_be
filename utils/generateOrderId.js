function generateOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '') // "20250613"
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `EXM-${date}-${suffix}` // → EXM-20250613-A3F9K
}
module.exports = { generateOrderId };