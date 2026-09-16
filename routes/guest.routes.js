const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/:eventId', asyncHandler(guestController.showLanding));
router.post('/:eventId/verify', asyncHandler(guestController.verifyPasscode));
router.post('/:eventId/rsvp', asyncHandler(guestController.submitRsvp));
router.get('/:eventId/itinerary', asyncHandler(guestController.showItinerary));

module.exports = router;
