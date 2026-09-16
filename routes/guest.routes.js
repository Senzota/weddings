const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/:eventId', asyncHandler(guestController.showPasscodeForm));
router.post('/:eventId/verify', asyncHandler(guestController.verifyPasscode));
router.post('/:eventId/rsvp', asyncHandler(guestController.submitRsvp));

module.exports = router;
