const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const orderRoutes = require('./routes/order.routes')
app.use('/api', orderRoutes)

module.exports = app