const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/:eventId', asyncHandler(guestController.showInvitation));
router.post('/:eventId/verify', asyncHandler(guestController.verifyPasscode));
router.post('/:eventId/rsvp', asyncHandler(guestController.submitRsvp));
router.get('/:eventId/gallery', asyncHandler(guestController.showGallery));
router.get('/:eventId/cameos', asyncHandler(guestController.showCameos));
router.get('/:eventId/other-details', asyncHandler(guestController.showOtherDetails));

module.exports = router;
