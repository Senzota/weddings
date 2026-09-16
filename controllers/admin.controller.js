const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const eventModel = require('../models/event.model');
const guestModel = require('../models/guest.model');
const { archiveAndDelete } = require('../models/archive.model');

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
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.render('admin/events-list', { events, baseUrl });
}

function newEventForm(req, res) {
  res.render('admin/event-form', { event: null, error: null });
}

async function createEvent(req, res) {
  const { coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, declineMessage } = req.body;
  if (!coupleNames || !weddingDate || !venue) {
    return res.render('admin/event-form', { event: null, error: 'Couple names, date, and venue are required.' });
  }
  const event = await eventModel.create({
    coupleNames, weddingDate, venue,
    themeColor: themeColor || '#8a6d3b',
    acceptButtonText: acceptButtonText || 'Accept with pleasure',
    declineButtonText: declineButtonText || 'Decline with regret',
    declineMessage: declineMessage || undefined,
  });
  res.redirect(`/admin/events/${event.id}`);
}

async function showDashboard(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const guests = await guestModel.findByEvent(event.id);
  const stats = await eventModel.getStats(event.id);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.render('admin/dashboard', { event, guests, stats, error: null, baseUrl });
}

async function updateEvent(req, res) {
  const { coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, declineMessage } = req.body;
  if (!coupleNames || !weddingDate || !venue) {
    const event = await eventModel.findById(req.params.id);
    const guests = await guestModel.findByEvent(req.params.id);
    const stats = await eventModel.getStats(req.params.id);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return res.status(400).render('admin/dashboard', {
      event, guests, stats, baseUrl, error: 'Couple names, date, and venue are required.',
    });
  }
  const cardImage = req.file ? `/uploads/${req.file.filename}` : null;
  await eventModel.update(req.params.id, {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage, cardImage,
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

async function deleteEvent(req, res) {
  const archived = await archiveAndDelete(req.params.id);
  if (!archived) return res.status(404).send('Wedding not found.');
  res.redirect('/admin/events');
}

async function exportGuestList(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const guests = await guestModel.findByEvent(event.id);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Guests');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Seats', key: 'seats', width: 10 },
    { header: 'Passcode', key: 'passcode', width: 15 },
    { header: 'RSVP Status', key: 'rsvp', width: 15 },
    { header: 'Checked In', key: 'checkedIn', width: 12 },
  ];
  for (const guest of guests) {
    sheet.addRow({
      name: guest.name,
      seats: guest.seat_count,
      passcode: guest.passcode,
      rsvp: guest.rsvp_status,
      checkedIn: guest.checked_in ? 'Yes' : 'No',
    });
  }

  const safeName = event.couple_names.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-guests.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = {
  showLogin, login, logout,
  listEvents, newEventForm, createEvent,
  showDashboard, updateEvent, toggleStatus, bulkAddGuests, deleteEvent,
  exportGuestList,
};
