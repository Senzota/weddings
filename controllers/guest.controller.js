const guestModel = require('../models/guest.model');
const eventModel = require('../models/event.model');
const gatepassModel = require('../models/gatepass.model');
const { generateQrDataUrl } = require('../utils/qrGenerator');

const CHECKED_IN_QR_WINDOW_HOURS = 6;

// Shared by verifyPasscode and submitRsvp — both end up needing to show
// "whatever this guest's current state is" after resolving who they are.
async function renderGuestState(res, event, guest, extra = {}) {
  if (guest.rsvp_status === 'pending') {
    return res.render('guest/invite', { state: 'card', event, guest, welcomeBack: false, ...extra });
  }
  if (guest.rsvp_status === 'declined') {
    // Decline isn't final — this is the same card as 'pending', plus a
    // welcome-back banner, and only the Accept action (no point offering
    // "decline" again).
    return res.render('guest/invite', { state: 'card', event, guest, welcomeBack: true, ...extra });
  }

  // accepted — final, and shown with the invitation card alongside the QR
  // rather than replacing it (the guest should still feel like they're
  // looking at "their invitation," with the gatepass as an addition).
  let gatepass = await gatepassModel.findByGuestId(guest.id);
  if (!gatepass) gatepass = await gatepassModel.create(guest.id);

  if (gatepass.checked_in) {
    const hoursSinceCheckIn = (Date.now() - new Date(gatepass.checked_in_at).getTime()) / 3600000;
    if (hoursSinceCheckIn >= CHECKED_IN_QR_WINDOW_HOURS) {
      return res.render('guest/invite', { state: 'expired', event, guest, ...extra });
    }
  }
  const qrDataUrl = await generateQrDataUrl(gatepass.qr_token);
  return res.render('guest/invite', { state: 'qr', event, guest, qrDataUrl, checkedIn: gatepass.checked_in, ...extra });
}

// events.id is a plain serial integer — a non-numeric :eventId (an old
// bookmarked link from before this route shape changed, or just a typo)
// would otherwise reach the DB as "invalid input syntax for type integer"
// and surface as a raw 500 instead of a clean 404. Also centralizes the
// draft/live check shared by all three guest routes.
async function resolveLiveEvent(req, res) {
  if (!/^\d+$/.test(req.params.eventId)) {
    res.status(404).render('guest/invite', { state: 'not_found' });
    return null;
  }
  const event = await eventModel.findById(req.params.eventId);
  if (!event) {
    res.status(404).render('guest/invite', { state: 'not_found' });
    return null;
  }
  if (event.status !== 'live') {
    res.render('guest/invite', { state: 'not_live' });
    return null;
  }
  return event;
}

async function showPasscodeForm(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;
  return res.render('guest/invite', { state: 'passcode_form', event, error: null });
}

async function verifyPasscode(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    return res.render('guest/invite', { state: 'passcode_form', event, error: 'That passcode was not recognized.' });
  }
  return renderGuestState(res, event, guest);
}

async function submitRsvp(req, res) {
  const event = await resolveLiveEvent(req, res);
  if (!event) return;

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    return res.render('guest/invite', { state: 'passcode_form', event, error: 'That passcode was not recognized.' });
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

module.exports = { showPasscodeForm, verifyPasscode, submitRsvp };
