const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

router.get('/', vendorController.listVendors);
router.post('/', vendorController.addVendor);
router.delete('/:id', vendorController.deleteVendor);
router.get('/min-cost', vendorController.getMinCostVendor);
router.get('/best-value', vendorController.getBestValueVendor);
router.get('/search/:type/:query', vendorController.searchVendors);
router.post('/:id/ratings', vendorController.addRating);
router.get('/:id/ratings', vendorController.listRatings);

module.exports = router;
