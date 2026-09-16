const guestModel = require('../models/guest.model');
const eventModel = require('../models/event.model');
const gatepassModel = require('../models/gatepass.model');
const galleryModel = require('../models/gallery.model');
const cameoModel = require('../models/cameo.model');
const { generateQrDataUrl } = require('../utils/qrGenerator');

const CHECKED_IN_QR_WINDOW_HOURS = 6;

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

// One template covers the whole continuous scroll (hero, QR/state area,
// message, button row, itinerary, contacts). guest is null on a plain
// GET (no passcode submitted yet in this request — there's no session,
// so identity is only known within the request that verified it); the
// hero/overlay/tile-row/itinerary/contacts sections render regardless,
// and the guest-state area + message only appear once guest is resolved.
async function renderInvitation(res, event, guest, extra = {}) {
  const view = `guest/themes/${event.theme}/invitation`;
  if (!guest) {
    return res.render(view, { event, guest: null, state: null, ...extra });
  }

  if (guest.rsvp_status === 'pending') {
    return res.render(view, { event, guest, state: 'card', welcomeBack: false, ...extra });
  }
  if (guest.rsvp_status === 'declined') {
    // Decline isn't final — same actionable state as pending, plus a
    // welcome-back banner, and only the Accept action.
    return res.render(view, { event, guest, state: 'card', welcomeBack: true, ...extra });
  }

  // accepted — final. QR renders directly in the scroll, no card box.
  let gatepass = await gatepassModel.findByGuestId(guest.id);
  if (!gatepass) gatepass = await gatepassModel.create(guest.id);

  if (gatepass.checked_in) {
    const hoursSinceCheckIn = (Date.now() - new Date(gatepass.checked_in_at).getTime()) / 3600000;
    if (hoursSinceCheckIn >= CHECKED_IN_QR_WINDOW_HOURS) {
      return res.render(view, { event, guest, state: 'expired', ...extra });
    }
  }
  const qrDataUrl = await generateQrDataUrl(gatepass.qr_token);
  return res.render(view, { event, guest, state: 'qr', qrDataUrl, checkedIn: gatepass.checked_in, ...extra });
}

async function showInvitation(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;
  const error = req.query.error === 'invalid' ? 'That passcode was not recognized.' : null;
  return renderInvitation(res, event, null, { error });
}

async function verifyPasscode(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    // Redirects (rather than re-rendering) so the overlay's error state is
    // reached the same way regardless of how the guest got there, and a
    // reload of the result page doesn't resubmit the passcode.
    return res.redirect(`/invite/${event.id}?error=invalid`);
  }
  return renderInvitation(res, event, guest);
}

async function submitRsvp(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    return res.redirect(`/invite/${event.id}?error=invalid`);
  }

  // Accept is final and reachable from 'pending' or 'declined' (a guest
  // can change their mind). Decline is only reachable from 'pending' —
  // once accepted, nothing can move the status again. guest.model.js's
  // recordRsvp enforces this same rule at the query level; the check here
  // just avoids a pointless write attempt.
  const { response } = req.body;
  const canAccept = response === 'accepted' && (guest.rsvp_status === 'pending' || guest.rsvp_status === 'declined');
  const canDecline = response === 'declined' && guest.rsvp_status === 'pending';
  if (canAccept || canDecline) {
    // Written unconditionally, before the gatepass/QR step — a guest's
    // response must never be lost, and there's no email delivery in this
    // path at all to fail on.
    const updated = await guestModel.recordRsvp(guest.id, response);
    if (updated) guest.rsvp_status = updated.rsvp_status;
    if (guest.rsvp_status === 'accepted') {
      await gatepassModel.create(guest.id);
    }
  }

  return renderInvitation(res, event, guest);
}

// Gallery has real content now (input_11) — actual uploaded photos, not
// an empty placeholder — so it gets the same passcode gate as the main
// invitation, per the gap input_9 deliberately left open for this exact
// moment. Since there's no session, the passcode travels as a query
// param on the link the invitation page hands out (guest.passcode is
// already known there) rather than a POST body — same trust boundary as
// everywhere else in this app, just carried differently for a plain GET.
async function showGallery(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  const guest = await guestModel.findByEventAndPasscode(event.id, req.query.passcode || '');
  if (!guest) {
    const error = req.query.passcode ? 'That passcode was not recognized.' : null;
    return res.render(`guest/themes/${event.theme}/gallery`, { event, guest: null, photos: null, error });
  }

  const photos = await galleryModel.findByEvent(event.id);
  return res.render(`guest/themes/${event.theme}/gallery`, { event, guest, photos, error: null });
}

// Same passcode-gate pattern as Gallery — Cameos has real, event-specific
// photos (and the family/friend circle's own names/captions) worth the
// same protection.
async function showCameos(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  const guest = await guestModel.findByEventAndPasscode(event.id, req.query.passcode || '');
  if (!guest) {
    const error = req.query.passcode ? 'That passcode was not recognized.' : null;
    return res.render(`guest/themes/${event.theme}/cameos`, { event, guest: null, photos: null, error });
  }

  const photos = await cameoModel.findByEvent(event.id);
  return res.render(`guest/themes/${event.theme}/cameos`, { event, guest, photos, error: null });
}

async function showOtherDetails(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;
  return res.render(`guest/themes/${event.theme}/other-details`, { event });
}

module.exports = { showInvitation, verifyPasscode, submitRsvp, showGallery, showCameos, showOtherDetails };
