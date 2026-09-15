const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', scanController.showScanner);
router.post('/verify', asyncHandler(scanController.verify));

module.exports = router;
