const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const asyncHandler = require('../utils/asyncHandler');

// input_20 Phase 9B (M-2): same windowMs/max/header config as the existing
// inquiryLimiter (routes/public.routes.js) and bookEventLimiter
// (routes/client.routes.js) — scoped to this one route only, never applied
// globally, so every read-only invitation/gallery/cameo/other-details page
// and the RSVP/gatepass paths stay structurally unreachable by it. A
// passcode verifies a specific named guest and can lead to RSVP/gatepass
// access, so unlimited online guessing must be bounded the same way an
// inquiry submission or a booking request already is.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:eventId', asyncHandler(guestController.showInvitation));
router.post('/:eventId/verify', verifyLimiter, asyncHandler(guestController.verifyPasscode));
router.post('/:eventId/rsvp', asyncHandler(guestController.submitRsvp));
router.get('/:eventId/gallery', asyncHandler(guestController.showGallery));
router.get('/:eventId/cameos', asyncHandler(guestController.showCameos));
router.get('/:eventId/other-details', asyncHandler(guestController.showOtherDetails));

module.exports = router;
