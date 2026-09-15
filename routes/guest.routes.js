const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/:passcode', asyncHandler(guestController.showInvite));
router.post('/:passcode/email', asyncHandler(guestController.submitEmail));
router.post('/:passcode/rsvp', asyncHandler(guestController.submitRsvp));

module.exports = router;
