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
router.get('/events/:id/edit', requireAdmin, asyncHandler(adminController.showEditForm));
router.post('/events/:id', requireAdmin, upload.single('cardImage'), asyncHandler(adminController.updateEvent));
router.post('/events/:id/status', requireAdmin, asyncHandler(adminController.toggleStatus));
router.post('/events/:id/guests', requireAdmin, asyncHandler(adminController.bulkAddGuests));
router.post('/events/:id/delete', requireAdmin, asyncHandler(adminController.deleteEvent));
router.get('/events/:id/export', requireAdmin, asyncHandler(adminController.exportGuestList));
router.get('/events/:id/assets', requireAdmin, asyncHandler(adminController.showAssets));
router.post('/events/:id/gallery', requireAdmin, upload.array('photos', 20), asyncHandler(adminController.uploadGalleryPhotos));
router.post('/events/:id/gallery/:photoId/delete', requireAdmin, asyncHandler(adminController.deleteGalleryPhoto));
router.post('/events/:id/cameos', requireAdmin, upload.single('photo'), asyncHandler(adminController.uploadCameoPhoto));
router.post('/events/:id/cameos/:photoId/delete', requireAdmin, asyncHandler(adminController.deleteCameoPhoto));

module.exports = router;
