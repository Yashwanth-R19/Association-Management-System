const express = require('express');
const router = express.Router();
const duesController = require('../controllers/duesController');

router.get('/', duesController.listDues);
router.get('/unpaid', duesController.listUnpaidDues);
router.get('/resident/:doorNumber', duesController.listDuesForResident);
router.post('/', duesController.addDue);
router.post('/:id/pay', duesController.markPaid);
router.delete('/:id', duesController.deleteDue);

module.exports = router;
