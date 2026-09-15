const bcrypt = require('bcrypt');
const pool = require('../config/db');
const eventModel = require('../models/event.model');
const guestModel = require('../models/guest.model');

function showLogin(req, res) {
  res.render('admin/login', { error: null });
}

async function login(req, res) {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
  const admin = rows[0];
  const valid = admin && await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return res.render('admin/login', { error: 'Invalid email or password.' });
  }
  req.session.adminId = admin.id;
  res.redirect('/admin/events');
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/admin/login'));
}

async function listEvents(req, res) {
  const events = await eventModel.findAll();
  res.render('admin/events-list', { events });
}

function newEventForm(req, res) {
  res.render('admin/event-form', { event: null, error: null });
}

async function createEvent(req, res) {
  const { coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText } = req.body;
  if (!coupleNames || !weddingDate || !venue) {
    return res.render('admin/event-form', { event: null, error: 'Couple names, date, and venue are required.' });
  }
  const event = await eventModel.create({
    coupleNames, weddingDate, venue,
    themeColor: themeColor || '#8a6d3b',
    acceptButtonText: acceptButtonText || 'Accept with pleasure',
    declineButtonText: declineButtonText || 'Decline with regret',
  });
  res.redirect(`/admin/events/${event.id}`);
}

async function showDashboard(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const guests = await guestModel.findByEvent(event.id);
  const stats = await eventModel.getStats(event.id);
  res.render('admin/dashboard', { event, guests, stats, error: null });
}

async function updateEvent(req, res) {
  const { coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText } = req.body;
  const cardImage = req.file ? `/uploads/${req.file.filename}` : null;
  await eventModel.update(req.params.id, {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, cardImage,
  });
  res.redirect(`/admin/events/${req.params.id}`);
}

async function toggleStatus(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const nextStatus = event.status === 'live' ? 'draft' : 'live';
  await eventModel.setStatus(event.id, nextStatus);
  res.redirect(`/admin/events/${req.params.id}`);
}

// Bulk-add guests from pasted "Name, seat count" lines, one guest per line.
async function bulkAddGuests(req, res) {
  const { guestList } = req.body;
  const lines = (guestList || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const entries = lines.map((line) => {
    const [name, seatCountRaw] = line.split(',').map((part) => part.trim());
    const seatCount = parseInt(seatCountRaw, 10);
    return { name, seatCount: Number.isFinite(seatCount) && seatCount > 0 ? seatCount : 1 };
  }).filter((entry) => entry.name);

  if (entries.length > 0) {
    await guestModel.bulkCreate(req.params.id, entries);
  }
  res.redirect(`/admin/events/${req.params.id}`);
}

module.exports = {
  showLogin, login, logout,
  listEvents, newEventForm, createEvent,
  showDashboard, updateEvent, toggleStatus, bulkAddGuests,
};
