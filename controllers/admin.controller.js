const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const eventModel = require('../models/event.model');
const guestModel = require('../models/guest.model');
const galleryModel = require('../models/gallery.model');
const cameoModel = require('../models/cameo.model');
const { archiveAndDelete } = require('../models/archive.model');
const { AVAILABLE_THEMES } = require('../config/themes');
const { uploadImage, deleteImage } = require('../utils/cloudinary');

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
  res.render('admin/event-form', { event: null, error: null, themes: AVAILABLE_THEMES });
}

async function createEvent(req, res) {
  const { coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, declineMessage, theme } = req.body;
  if (!coupleNames || !weddingDate || !venue) {
    return res.render('admin/event-form', { event: null, error: 'Couple names, date, and venue are required.', themes: AVAILABLE_THEMES });
  }
  const event = await eventModel.create({
    coupleNames, weddingDate, venue,
    themeColor: themeColor || '#8a6d3b',
    acceptButtonText: acceptButtonText || 'Accept with pleasure',
    declineButtonText: declineButtonText || 'Decline with regret',
    declineMessage: declineMessage || undefined,
    theme,
  });
  res.redirect(`/admin/events/${event.id}`);
}

// Wedding date is a plain 'YYYY-MM-DD' string (see config/db.js's type
// parser) — building the Date from an explicit local-midnight literal
// avoids the same UTC-shift bug that parser exists to prevent.
function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  const diffMs = target.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / 86400000));
}

async function showDashboard(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const guests = await guestModel.findByEvent(event.id);
  const stats = await eventModel.getStats(event.id);
  const galleryPhotos = await galleryModel.findByEvent(event.id);
  const cameoPhotos = await cameoModel.findByEvent(event.id);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.render(`admin/themes/${event.theme}/dashboard`, {
    event, guests, stats, galleryPhotos, cameoPhotos, baseUrl,
    daysToGo: daysUntil(event.wedding_date), themes: AVAILABLE_THEMES,
  });
}

async function showEditForm(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const error = req.query.error ? 'Couple names, date, and venue are required.' : null;
  res.render('admin/edit-event', { event, error, themes: AVAILABLE_THEMES });
}

async function showAssets(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  const galleryPhotos = await galleryModel.findByEvent(event.id);
  const cameoPhotos = await cameoModel.findByEvent(event.id);
  res.render('admin/assets', { event, galleryPhotos, cameoPhotos });
}

async function updateEvent(req, res) {
  const {
    coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText,
    declineMessage, itinerary, invitationMessage, contactDetails, theme,
  } = req.body;
  if (!coupleNames || !weddingDate || !venue) {
    // Both the dedicated edit page and Botanical Bloom's inline dashboard
    // form post here — redirecting to the edit page on failure (rather
    // than re-rendering whichever page submitted) keeps this one handler
    // simple; browsers already block empty required fields client-side,
    // so this path is rare.
    return res.redirect(`/admin/events/${req.params.id}/edit?error=1`);
  }

  let cardImage;
  let cardImagePublicId;
  if (req.file) {
    const result = await uploadImage(req.file.buffer, `weddings103/events/${req.params.id}`);
    cardImage = result.secure_url;
    cardImagePublicId = result.public_id;

    // Best-effort cleanup of the image this one replaces — don't leave it
    // orphaned on Cloudinary, but don't let a delete failure block the
    // update that already succeeded.
    const existing = await eventModel.findById(req.params.id);
    if (existing && existing.card_image_public_id) {
      deleteImage(existing.card_image_public_id).catch((err) => {
        console.error(`Failed to delete replaced Cloudinary image ${existing.card_image_public_id}:`, err);
      });
    }
  }

  await eventModel.update(req.params.id, {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage, cardImage, cardImagePublicId,
    itinerary, invitationMessage, contactDetails, theme,
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

// One or more photos in a single request (upload.array).
async function uploadGalleryPhotos(req, res) {
  const files = req.files || [];
  for (const file of files) {
    const result = await uploadImage(file.buffer, `weddings103/events/${req.params.id}/gallery`);
    await galleryModel.addPhoto(req.params.id, result.secure_url, result.public_id);
  }
  res.redirect(`/admin/events/${req.params.id}/assets`);
}

async function deleteGalleryPhoto(req, res) {
  const photo = await galleryModel.deletePhoto(req.params.id, req.params.photoId);
  if (photo) {
    try {
      await deleteImage(photo.public_id);
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${photo.public_id}:`, err);
    }
  }
  res.redirect(`/admin/events/${req.params.id}/assets`);
}

// Cameos are uploaded one at a time with a title, unlike Gallery's
// multi-file batch — each entry is meant to carry its own caption.
async function uploadCameoPhoto(req, res) {
  const { title } = req.body;
  if (req.file) {
    const result = await uploadImage(req.file.buffer, `weddings103/events/${req.params.id}/cameos`);
    await cameoModel.addPhoto(req.params.id, result.secure_url, result.public_id, title || null);
  }
  res.redirect(`/admin/events/${req.params.id}/assets`);
}

async function deleteCameoPhoto(req, res) {
  const photo = await cameoModel.deletePhoto(req.params.id, req.params.photoId);
  if (photo) {
    try {
      await deleteImage(photo.public_id);
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${photo.public_id}:`, err);
    }
  }
  res.redirect(`/admin/events/${req.params.id}/assets`);
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
  showDashboard, showEditForm, showAssets, updateEvent, toggleStatus, bulkAddGuests, deleteEvent,
  exportGuestList, uploadGalleryPhotos, deleteGalleryPhoto,
  uploadCameoPhoto, deleteCameoPhoto,
};
