const guestModel = require('../models/guest.model');
const eventModel = require('../models/event.model');
const gatepassModel = require('../models/gatepass.model');
const { generateQrImageBuffer } = require('../utils/qrGenerator');
const { sendGatepassEmail } = require('../utils/mailer');

async function showInvite(req, res) {
  const guest = await guestModel.findByPasscodeOnly(req.params.passcode);
  if (!guest) return res.status(404).render('guest/invite', { state: 'not_found' });

  const event = await eventModel.findById(guest.event_id);
  if (event.status !== 'live') {
    return res.render('guest/invite', { state: 'not_live', event });
  }
  if (guest.rsvp_status !== 'pending') {
    return res.render('guest/invite', { state: 'responded', guest, event });
  }
  if (!guest.email) {
    return res.render('guest/invite', { state: 'email_capture', guest, event });
  }
  return res.render('guest/invite', { state: 'card', guest, event });
}

async function submitEmail(req, res) {
  const guest = await guestModel.findByPasscodeOnly(req.params.passcode);
  if (!guest) return res.status(404).render('guest/invite', { state: 'not_found' });

  const event = await eventModel.findById(guest.event_id);
  if (event.status !== 'live' || guest.rsvp_status !== 'pending') {
    return res.redirect(`/invite/${req.params.passcode}`);
  }

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.render('guest/invite', { state: 'email_capture', guest, event, error: 'Please enter a valid email.' });
  }
  await guestModel.setEmail(guest.id, email);
  return res.redirect(`/invite/${req.params.passcode}`);
}

async function submitRsvp(req, res) {
  const guest = await guestModel.findByPasscodeOnly(req.params.passcode);
  if (!guest) return res.status(404).render('guest/invite', { state: 'not_found' });

  const event = await eventModel.findById(guest.event_id);
  if (event.status !== 'live' || guest.rsvp_status !== 'pending' || !guest.email) {
    return res.redirect(`/invite/${req.params.passcode}`);
  }

  const { response } = req.body;
  if (response !== 'accepted' && response !== 'declined') {
    return res.redirect(`/invite/${req.params.passcode}`);
  }

  // RSVP is written unconditionally before any email is attempted — a
  // guest's response must never be lost to a delivery hiccup.
  const updated = await guestModel.recordRsvp(guest.id, response);
  if (!updated) return res.redirect(`/invite/${req.params.passcode}`);

  if (response === 'accepted') {
    const gatepass = await gatepassModel.create(guest.id);
    const qrImageBuffer = await generateQrImageBuffer(gatepass.qr_token);
    await sendGatepassEmail({
      to: guest.email,
      coupleNames: event.couple_names,
      qrImageBuffer,
    });
  }

  return res.redirect(`/invite/${req.params.passcode}`);
}

module.exports = { showInvite, submitEmail, submitRsvp };
