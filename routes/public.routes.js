const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const publicController = require('../controllers/public.controller');
const asyncHandler = require('../utils/asyncHandler');

// input_20 Phase 5: scoped to this one route only — never applied globally,
// so /admin/login, RSVP, guest verification, the scanner, and every
// invitation route are structurally unreachable by it.
const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', publicController.showHome);
router.post('/inquiries', inquiryLimiter, asyncHandler(publicController.createInquiry));

module.exports = router;
