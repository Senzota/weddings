const guestModel = require('../models/guest.model');
const eventModel = require('../models/event.model');
const gatepassModel = require('../models/gatepass.model');
const { generateQrDataUrl } = require('../utils/qrGenerator');

const CHECKED_IN_QR_WINDOW_HOURS = 6;

// Shared by verifyPasscode and submitRsvp — both end up needing to show
// "whatever this guest's current state is" after resolving who they are.
// Themed per-event (event.theme), so a second design later is just another
// views/guest/themes/<slug>/ folder — no branching needed here.
async function renderGuestState(res, event, guest, extra = {}) {
  const view = `guest/themes/${event.theme}/reveal`;

  if (guest.rsvp_status === 'pending') {
    return res.render(view, { state: 'card', event, guest, welcomeBack: false, ...extra });
  }
  if (guest.rsvp_status === 'declined') {
    // Decline isn't final — this is the same card as 'pending', plus a
    // welcome-back banner, and only the Accept action (no point offering
    // "decline" again).
    return res.render(view, { state: 'card', event, guest, welcomeBack: true, ...extra });
  }

  // accepted — final, and shown with the invitation card alongside the QR
  // rather than replacing it (the guest should still feel like they're
  // looking at "their invitation," with the gatepass as an addition).
  let gatepass = await gatepassModel.findByGuestId(guest.id);
  if (!gatepass) gatepass = await gatepassModel.create(guest.id);

  if (gatepass.checked_in) {
    const hoursSinceCheckIn = (Date.now() - new Date(gatepass.checked_in_at).getTime()) / 3600000;
    if (hoursSinceCheckIn >= CHECKED_IN_QR_WINDOW_HOURS) {
      return res.render(view, { state: 'expired', event, guest, ...extra });
    }
  }
  const qrDataUrl = await generateQrDataUrl(gatepass.qr_token);
  return res.render(view, { state: 'qr', event, guest, qrDataUrl, checkedIn: gatepass.checked_in, ...extra });
}

// events.id is a plain serial integer — a non-numeric :eventId (an old
// bookmarked link, or just a typo) would otherwise reach the DB as
// "invalid input syntax for type integer" and surface as a raw 500
// instead of a clean 404. Also centralizes the draft/live check shared by
// every guest route. Not-found/not-live are deliberately outside the
// theme system (guest/error.ejs) — they're edge cases, not one of the
// four designed pages.
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

async function showLanding(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;
  const error = req.query.error === 'invalid' ? 'That passcode was not recognized.' : null;
  return res.render(`guest/themes/${event.theme}/landing`, { event, error });
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
  return renderGuestState(res, event, guest);
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
    // response must never be lost, and there's no email delivery left in
    // this path at all to fail on.
    const updated = await guestModel.recordRsvp(guest.id, response);
    if (updated) guest.rsvp_status = updated.rsvp_status;
    if (guest.rsvp_status === 'accepted') {
      await gatepassModel.create(guest.id);
    }
  }

  return renderGuestState(res, event, guest);
}

async function showItinerary(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;
  return res.render(`guest/themes/${event.theme}/itinerary`, { event });
}

module.exports = { showLanding, verifyPasscode, submitRsvp, showItinerary };
