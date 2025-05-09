const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', staffController.getAllStaff);
router.post('/', staffController.addStaff);
router.post('/checkout', staffController.checkOutStaff);
router.delete('/:staffName', staffController.deleteStaff);
router.get('/search', staffController.searchStaff);

module.exports = router;