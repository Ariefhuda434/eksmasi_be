const express = require('express')
const router = express.Router()
const controller = require('../controllers/order.controller')

router.post('/orders', controller.createOrder)
router.get('/orders/:id', controller.getOrder)
router.post('/orders/:id/upload-proof', controller.upload.single('proof'), controller.uploadProof)

module.exports = router