const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { requireAdmin } = require('../middleware/auth.middleware');
const upload = require('../config/upload');

router.get('/login', adminController.showLogin);
router.post('/login', adminController.login);
router.post('/logout', requireAdmin, adminController.logout);

router.get('/events', requireAdmin, adminController.listEvents);
router.get('/events/new', requireAdmin, adminController.newEventForm);
router.post('/events', requireAdmin, adminController.createEvent);

router.get('/events/:id', requireAdmin, adminController.showDashboard);
router.post('/events/:id', requireAdmin, upload.single('cardImage'), adminController.updateEvent);
router.post('/events/:id/status', requireAdmin, adminController.toggleStatus);
router.post('/events/:id/guests', requireAdmin, adminController.bulkAddGuests);

module.exports = router;
