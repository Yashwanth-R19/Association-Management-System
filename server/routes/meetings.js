const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetingsController');

// GET all meetings
router.get('/', meetingsController.listMeetings);

// POST - Add new meeting
router.post('/', meetingsController.addMeeting);

// DELETE - Remove meeting
router.delete('/:id', meetingsController.deleteMeeting);

// Search routes
router.get('/search/:type/:query', meetingsController.searchMeetings);

module.exports = router;