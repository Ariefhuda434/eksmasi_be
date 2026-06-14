const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    // Ambil token dari header (support berbagai format)
    let token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ message: 'Akses ditolak - Token tidak ditemukan' });
    }

    // Bersihkan prefix "Bearer "
    if (token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    } else {
      token = token.trim();
    }

    if (!token) {
      return res.status(401).json({ message: 'Akses ditolak - Token kosong' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (err) {
    console.error('Auth Error:', err.message);
    return res.status(401).json({ 
      message: 'Akses ditolak - Token tidak valid',
      error: err.message 
    });
  }
};

module.exports = auth;