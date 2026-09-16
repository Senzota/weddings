const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { requireAdmin } = require('../middleware/auth.middleware');
const upload = require('../config/upload');
const asyncHandler = require('../utils/asyncHandler');

router.get('/login', adminController.showLogin);
router.post('/login', asyncHandler(adminController.login));
router.post('/logout', requireAdmin, adminController.logout);

router.get('/events', requireAdmin, asyncHandler(adminController.listEvents));
router.get('/events/new', requireAdmin, adminController.newEventForm);
router.post('/events', requireAdmin, asyncHandler(adminController.createEvent));

router.get('/events/:id', requireAdmin, asyncHandler(adminController.showDashboard));
router.post('/events/:id', requireAdmin, upload.single('cardImage'), asyncHandler(adminController.updateEvent));
router.post('/events/:id/status', requireAdmin, asyncHandler(adminController.toggleStatus));
router.post('/events/:id/guests', requireAdmin, asyncHandler(adminController.bulkAddGuests));
router.post('/events/:id/delete', requireAdmin, asyncHandler(adminController.deleteEvent));
router.get('/events/:id/export', requireAdmin, asyncHandler(adminController.exportGuestList));

module.exports = router;
