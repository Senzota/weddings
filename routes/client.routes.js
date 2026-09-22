const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const clientAccountController = require('../controllers/clientAccount.controller');
const { requireClient, requireClientAccount } = require('../middleware/auth.middleware');
const upload = require('../config/upload');
const asyncHandler = require('../utils/asyncHandler');

// input_20 Phase 11A: a narrowly-scoped equivalent of public.routes.js's
// own inquiryLimiter (same window/max) — a separate instance rather than
// an imported/shared one, so this router doesn't need to reach into
// public.routes.js and server.js stays untouched. Applied only to
// POST /client/book-event below; every other client route (dashboard,
// select-event, the Phase 8 portal) is unaffected.
const bookEventLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

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
// input_20 Phase 10C: account-owned-event handoff into the existing Phase 8
// portal. A POST route, so — unlike the GET routes above — it can never be
// shadowed by GET /:token below regardless of registration order; kept
// here anyway, grouped with the other requireClientAccount routes.
router.post('/select-event', requireClientAccount, asyncHandler(clientAccountController.selectEvent));
// input_20 Phase 11A: booking moves into the authenticated client account.
// Static routes, so — like /select-event above — never shadowed by
// GET /:token below regardless of order; grouped here with the other
// requireClientAccount routes for the same clarity reason.
router.get('/book-event', requireClientAccount, asyncHandler(clientAccountController.showBookEventForm));
router.post('/book-event', requireClientAccount, bookEventLimiter, asyncHandler(clientAccountController.submitBookEvent));

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
