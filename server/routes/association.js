const express = require('express');
const router = express.Router();
const associationController = require('../controllers/associationController');

// GET all members
router.get('/', associationController.listMembers);

// POST - Add new member
router.post('/', associationController.addMember);

// DELETE - Remove member
router.delete('/:id', associationController.deleteMember);

// Search routes
router.get('/search/:type/:query', associationController.searchMembers);

module.exports = router;