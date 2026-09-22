const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const clientAccountController = require('../controllers/clientAccount.controller');
const { requireClient, requireClientAccount } = require('../middleware/auth.middleware');
const upload = require('../config/upload');
const asyncHandler = require('../utils/asyncHandler');

// input_20 Phase 8 / Phase 10A. GET /:token is registered last among this
// router's GET routes deliberately — Express matches routes in
// registration order, and a wildcard single-segment GET route registered
// first would shadow every static single-segment GET route below it
// (/register, /login, /dashboard, /edit, /assets). POST routes never
// collide with GET routes regardless of order (different method), so this
// ordering constraint only applies within GET.
router.get('/register', asyncHandler(clientAccountController.showRegister));
router.post('/register', asyncHandler(clientAccountController.register));
router.get('/login', asyncHandler(clientAccountController.showLogin));
router.post('/login', asyncHandler(clientAccountController.login));
router.post('/logout', requireClientAccount, clientAccountController.logout);
router.get('/dashboard', requireClientAccount, asyncHandler(clientAccountController.showDashboard));

router.get('/edit', requireClient, asyncHandler(clientController.showEditForm));
router.get('/assets', requireClient, asyncHandler(clientController.showAssets));
router.get('/', requireClient, asyncHandler(clientController.showDashboard));

router.post('/', requireClient, upload.single('cardImage'), asyncHandler(clientController.updateEvent));
router.post('/publish', requireClient, asyncHandler(clientController.publish));
router.post('/guests', requireClient, asyncHandler(clientController.addGuests));
router.post('/assets/gallery', requireClient, upload.array('photos', 20), asyncHandler(clientController.uploadGalleryPhotos));
router.post('/assets/gallery/:photoId/delete', requireClient, asyncHandler(clientController.deleteGalleryPhoto));
router.post('/assets/cameo', requireClient, upload.single('photo'), asyncHandler(clientController.uploadCameoPhoto));
router.post('/assets/cameo/:photoId/delete', requireClient, asyncHandler(clientController.deleteCameoPhoto));

// Public bootstrap — no requireClient (this route IS the way clientEventId
// gets set in the first place). Must stay registered after /edit and
// /assets above so it never shadows them.
router.get('/:token', asyncHandler(clientController.bootstrap));

module.exports = router;
