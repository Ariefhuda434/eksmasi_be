require('dotenv').config()
const mysql = require('mysql2')

const dbConfig = {
  host: process.env.MYSQLHOST,
  port: parseInt(process.env.MYSQLPORT) || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}

console.log('DB CONFIG:', { ...dbConfig, password: '***' })

const db = mysql.createPool(dbConfig)

module.exports = db
