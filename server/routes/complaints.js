const express = require('express');
const router = express.Router();
const complaintsController = require('../controllers/complaintsController');

router.get('/', complaintsController.listComplaints);
router.post('/', complaintsController.addComplaint);
router.post('/:id/assign', complaintsController.assignComplaint);
router.post('/:id/resolve', complaintsController.resolveComplaint);
router.delete('/:id', complaintsController.deleteComplaint);
router.get('/search/:type/:query', complaintsController.searchComplaints);

module.exports = router;
