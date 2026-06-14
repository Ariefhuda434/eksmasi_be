require('dotenv').config()
const mysql = require('mysql2')

let db

if (process.env.MYSQL_URL) {
  const url = new URL(process.env.MYSQL_URL)
  db = mysql.createPool({
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: url.pathname.replace('/', ''),
    waitForConnections: true,
    connectionLimit: 10,
    ssl: { rejectUnauthorized: false }
  })
} else {
  db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  })
}

module.exports = db
