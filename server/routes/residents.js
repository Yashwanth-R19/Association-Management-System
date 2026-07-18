const express = require('express');
const router = express.Router();
const residentsController = require('../controllers/residentsController');

router.get('/', residentsController.listResidents);
router.post('/', residentsController.addResident);
router.delete('/:doorNumber', residentsController.deleteResident);

const searchTypes = ['door', 'phone', 'name', 'block', 'floor'];
searchTypes.forEach(type => {
    router.get(`/search/${type}/:query`, (req, res) => {
        req.params.type = type;
        residentsController.searchResidents(req, res);
    });
});

module.exports = router;
