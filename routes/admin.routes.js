const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin.controller')
const verifyToken = require('../middleware/auth')

router.post('/login', adminController.login)

router.get('/stats', verifyToken, adminController.getStats)
router.get('/orders', verifyToken, adminController.getAllOrders)
router.patch('/orders/:id/status', verifyToken, adminController.updateStatus)
router.delete('/orders/:id', verifyToken, adminController.deleteOrder)
router.get('/export', verifyToken, adminController.exportCSV)
router.post('/orders/:id/resend-ticket', verifyToken, adminController.resendTicket)

module.exports = router
