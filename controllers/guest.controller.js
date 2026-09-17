const guestModel = require('../models/guest.model');
const eventModel = require('../models/event.model');
const gatepassModel = require('../models/gatepass.model');
const galleryModel = require('../models/gallery.model');
const cameoModel = require('../models/cameo.model');
const { generateQrDataUrl } = require('../utils/qrGenerator');

const CHECKED_IN_QR_WINDOW_HOURS = 6;
// A guest may reasonably revisit their invite over weeks, not hours — once
// verified, extend the cookie well past express-session's default (and
// past the admin session's 8h) so "no re-entry of the passcode" actually
// holds for the life of the wedding, not just one browsing session.
const GUEST_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// events.id is a plain serial integer — a non-numeric :eventId (an old
// bookmarked link, or just a typo) would otherwise reach the DB as
// "invalid input syntax for type integer" and surface as a raw 500
// instead of a clean 404. Also centralizes the draft/live check shared by
// every guest route. Not-found/not-live are deliberately outside the
// theme system (guest/error.ejs) — they're edge cases, not part of the
// designed invitation scroll.
async function resolveLiveEvent(req, res) {
  if (!/^\d+$/.test(req.params.eventId)) {
    res.status(404).render('guest/error', { message: "We couldn't find this wedding." });
    return null;
  }
  const event = await eventModel.findById(req.params.eventId);
  if (!event) {
    res.status(404).render('guest/error', { message: "We couldn't find this wedding." });
    return null;
  }
  if (event.status !== 'live') {
    res.render('guest/error', { message: "This invitation isn't available yet. Please check back soon." });
    return null;
  }
  return event;
}

// input_13 Part C: identity persists via a durable server-side session
// (express-session, already backed by Postgres for the admin login) keyed
// per event — not front-end state, which is what was losing verification
// on every navigation. Checked first on every gated guest route, before
// ever asking for a passcode again. Irrelevant for 'open' events, which
// never gate on identity at all.
async function resolveSessionGuest(req, event) {
  const guestId = req.session.verifiedGuests && req.session.verifiedGuests[event.id];
  if (!guestId) return null;
  return guestModel.findByEventAndId(event.id, guestId);
}

function markVerified(req, event, guest) {
  req.session.verifiedGuests = req.session.verifiedGuests || {};
  req.session.verifiedGuests[event.id] = guest.id;
  req.session.cookie.maxAge = GUEST_SESSION_MAX_AGE;
}

// input_15: Lady Gianna's invitation scroll embeds a small gallery
// preview (grid + "see more" link) directly in the page, unlike the other
// themes which only link out to the dedicated /gallery route. Fetched
// only for that theme, and only once we're actually about to render
// content (never for state=null — nothing past the Hero leaks pre-gate).
async function galleryPreviewFor(event) {
  if (event.theme !== 'lady-gianna') return {};
  const photos = await galleryModel.findByEvent(event.id);
  return { galleryPreview: photos.slice(0, 6) };
}

// One template covers the whole continuous scroll (hero, QR/state area,
// message, button row, itinerary, contacts). Three broad states reach it:
//  - 'open' events: always full content, no guest identity at all, no
//    RSVP/QR of any kind (input_14 §2).
//  - 'recognized'/'closed', guest unresolved: overlay only (state=null).
//  - 'recognized'/'closed', guest resolved: state-area reflects their
//    RSVP status — 'qr' only ever happens for 'closed' events (input_14
//    §3: recognized tracks RSVP but never generates a gatepass).
async function renderInvitation(res, event, guest, extra = {}) {
  const view = `guest/themes/${event.theme}/invitation`;

  if (event.access_mode === 'open') {
    return res.render(view, { event, guest: null, state: 'open', ...await galleryPreviewFor(event), ...extra });
  }

  if (!guest) {
    return res.render(view, { event, guest: null, state: null, ...extra });
  }

  if (guest.rsvp_status === 'pending') {
    return res.render(view, { event, guest, state: 'card', welcomeBack: false, ...await galleryPreviewFor(event), ...extra });
  }
  if (guest.rsvp_status === 'declined') {
    // Decline isn't final — same actionable state as pending, plus a
    // welcome-back banner, and only the Accept action.
    return res.render(view, { event, guest, state: 'card', welcomeBack: true, ...await galleryPreviewFor(event), ...extra });
  }

  // accepted
  if (event.access_mode === 'recognized') {
    // Tracked, but no gatepass — there's no door check-in step for this
    // mode, so nothing for a QR to be checked against.
    return res.render(view, { event, guest, state: 'confirmed', ...await galleryPreviewFor(event), ...extra });
  }

  // 'closed' — final, and shown with the invitation alongside the QR
  // rather than replacing it.
  let gatepass = await gatepassModel.findByGuestId(guest.id);
  if (!gatepass) gatepass = await gatepassModel.create(guest.id);

  if (gatepass.checked_in) {
    const hoursSinceCheckIn = (Date.now() - new Date(gatepass.checked_in_at).getTime()) / 3600000;
    if (hoursSinceCheckIn >= CHECKED_IN_QR_WINDOW_HOURS) {
      return res.render(view, { event, guest, state: 'expired', ...await galleryPreviewFor(event), ...extra });
    }
  }
  const qrDataUrl = await generateQrDataUrl(gatepass.qr_token);
  return res.render(view, { event, guest, state: 'qr', qrDataUrl, checkedIn: gatepass.checked_in, ...await galleryPreviewFor(event), ...extra });
}

async function showInvitation(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  if (event.access_mode === 'open') {
    return renderInvitation(res, event, null);
  }

  const sessionGuest = await resolveSessionGuest(req, event);
  if (sessionGuest) return renderInvitation(res, event, sessionGuest);

  const error = req.query.error === 'invalid' ? 'That passcode was not recognized.' : null;
  return renderInvitation(res, event, null, { error });
}

async function verifyPasscode(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  // Nothing to verify for an open event — there's no overlay offering
  // this form in the first place, but guard the route directly too.
  if (event.access_mode === 'open') {
    return res.redirect(`/invite/${event.id}`);
  }

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    // Redirects (rather than re-rendering) so the overlay's error state is
    // reached the same way regardless of how the guest got there, and a
    // reload of the result page doesn't resubmit the passcode.
    return res.redirect(`/invite/${event.id}?error=invalid`);
  }
  markVerified(req, event, guest);
  return renderInvitation(res, event, guest);
}

async function submitRsvp(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  // No RSVP mechanism at all for open events (input_14 §2).
  if (event.access_mode === 'open') {
    return res.redirect(`/invite/${event.id}`);
  }

  const guest = (await resolveSessionGuest(req, event))
    || (await guestModel.findByEventAndPasscode(event.id, req.body.passcode || ''));
  if (!guest) {
    return res.redirect(`/invite/${event.id}?error=invalid`);
  }
  markVerified(req, event, guest);

  // Accept is final and reachable from 'pending' or 'declined' (a guest
  // can change their mind). Decline is only reachable from 'pending' —
  // once accepted, nothing can move the status again. guest.model.js's
  // recordRsvp enforces this same rule at the query level; the check here
  // just avoids a pointless write attempt.
  const { response } = req.body;
  const canAccept = response === 'accepted' && (guest.rsvp_status === 'pending' || guest.rsvp_status === 'declined');
  const canDecline = response === 'declined' && guest.rsvp_status === 'pending';
  if (canAccept || canDecline) {
    // Written unconditionally — a guest's response must never be lost,
    // and there's no email delivery in this path at all to fail on.
    // 'recognized' events stop right here: recorded and tracked, but
    // nothing downstream (no gatepass) reacts to acceptance.
    const updated = await guestModel.recordRsvp(guest.id, response);
    if (updated) guest.rsvp_status = updated.rsvp_status;
    if (guest.rsvp_status === 'accepted' && event.access_mode === 'closed') {
      await gatepassModel.create(guest.id);
    }
  }

  return renderInvitation(res, event, guest);
}

// Gallery has real content (input_11) worth gating for 'recognized'/
// 'closed' events, same as the main invitation — but an 'open' event has
// no guest identity to gate on at all, so it's just shown directly.
async function showGallery(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  if (event.access_mode === 'open') {
    const photos = await galleryModel.findByEvent(event.id);
    return res.render(`guest/themes/${event.theme}/gallery`, { event, guest: null, photos, error: null });
  }

  let guest = await resolveSessionGuest(req, event);
  if (!guest) guest = await guestModel.findByEventAndPasscode(event.id, req.query.passcode || '');
  if (!guest) {
    const error = req.query.passcode ? 'That passcode was not recognized.' : null;
    return res.render(`guest/themes/${event.theme}/gallery`, { event, guest: null, photos: null, error });
  }
  markVerified(req, event, guest);

  const photos = await galleryModel.findByEvent(event.id);
  return res.render(`guest/themes/${event.theme}/gallery`, { event, guest, photos, error: null });
}

// Same pattern as Gallery — open events skip the gate entirely.
async function showCameos(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  if (event.access_mode === 'open') {
    const photos = await cameoModel.findByEvent(event.id);
    return res.render(`guest/themes/${event.theme}/cameos`, { event, guest: null, photos, error: null });
  }

  let guest = await resolveSessionGuest(req, event);
  if (!guest) guest = await guestModel.findByEventAndPasscode(event.id, req.query.passcode || '');
  if (!guest) {
    const error = req.query.passcode ? 'That passcode was not recognized.' : null;
    return res.render(`guest/themes/${event.theme}/cameos`, { event, guest: null, photos: null, error });
  }
  markVerified(req, event, guest);

  const photos = await cameoModel.findByEvent(event.id);
  return res.render(`guest/themes/${event.theme}/cameos`, { event, guest, photos, error: null });
}

async function showOtherDetails(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;
  return res.render(`guest/themes/${event.theme}/other-details`, { event });
}

module.exports = { showInvitation, verifyPasscode, submitRsvp, showGallery, showCameos, showOtherDetails };
