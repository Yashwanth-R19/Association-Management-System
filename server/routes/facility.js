const express = require('express');
const router = express.Router();
const facilityController = require('../controllers/facilityController');

// Get all facility logs
router.get('/', facilityController.getFacilityLogs);
router.get('/search', facilityController.searchFacilityLogs);
// Add a new facility log
router.post('/', facilityController.addFacilityLog);

module.exports = router;