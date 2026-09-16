const guestModel = require('../models/guest.model');
const eventModel = require('../models/event.model');
const gatepassModel = require('../models/gatepass.model');
const { generateQrDataUrl } = require('../utils/qrGenerator');

const CHECKED_IN_QR_WINDOW_HOURS = 6;

// Shared by verifyPasscode and submitRsvp — both end up needing to show
// "whatever this guest's current state is" after resolving who they are.
async function renderGuestState(res, event, guest, extra = {}) {
  if (guest.rsvp_status === 'pending') {
    return res.render('guest/invite', { state: 'card', event, guest, ...extra });
  }
  if (guest.rsvp_status === 'declined') {
    return res.render('guest/invite', { state: 'declined', event, guest, ...extra });
  }

  // accepted
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

async function showPasscodeForm(req, res) {
  const event = await eventModel.findById(req.params.eventId);
  if (!event) return res.status(404).render('guest/invite', { state: 'not_found' });
  if (event.status !== 'live') return res.render('guest/invite', { state: 'not_live' });
  return res.render('guest/invite', { state: 'passcode_form', event, error: null });
}

async function verifyPasscode(req, res) {
  const event = await eventModel.findById(req.params.eventId);
  if (!event) return res.status(404).render('guest/invite', { state: 'not_found' });
  if (event.status !== 'live') return res.render('guest/invite', { state: 'not_live' });

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    return res.render('guest/invite', { state: 'passcode_form', event, error: 'That passcode was not recognized.' });
  }
  return renderGuestState(res, event, guest);
}

async function submitRsvp(req, res) {
  const event = await eventModel.findById(req.params.eventId);
  if (!event) return res.status(404).render('guest/invite', { state: 'not_found' });
  if (event.status !== 'live') return res.render('guest/invite', { state: 'not_live' });

  const guest = await guestModel.findByEventAndPasscode(event.id, req.body.passcode || '');
  if (!guest) {
    return res.render('guest/invite', { state: 'passcode_form', event, error: 'That passcode was not recognized.' });
  }

  const { response } = req.body;
  if (guest.rsvp_status === 'pending' && (response === 'accepted' || response === 'declined')) {
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
