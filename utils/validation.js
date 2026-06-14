function validateOrderInput({ name, email, phone }) {
  const errors = []

  if (!name || name.trim().length < 2) errors.push('Nama minimal 2 karakter')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email tidak valid')
  if (!phone || !/^[0-9]{9,15}$/.test(phone.replace(/[\s\-+]/g, ''))) errors.push('Nomor telepon tidak valid')

  return errors
}

module.exports = { validateOrderInput }
