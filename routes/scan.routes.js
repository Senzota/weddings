const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');

router.get('/', scanController.showScanner);
router.post('/verify', scanController.verify);

module.exports = router;
