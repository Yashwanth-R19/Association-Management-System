const express = require('express');
const router = express.Router();
const noticesController = require('../controllers/noticesController');

router.get('/', noticesController.listNotices);
router.post('/', noticesController.addNotice);
router.delete('/:id', noticesController.deleteNotice);

module.exports = router;
