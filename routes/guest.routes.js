const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');

router.get('/:passcode', guestController.showInvite);
router.post('/:passcode/email', guestController.submitEmail);
router.post('/:passcode/rsvp', guestController.submitRsvp);

module.exports = router;
