const adminController = require('./admin.controller');
const clientAccessModel = require('../models/clientAccess.model');

// input_20 Phase 8: every handler below derives the event id solely from
// req.session.clientEventId — never from req.params/req.query/req.body,
// so there is nothing in a request a client controls that could ever
// select a different event. Each calls the same data/action cores
// admin.controller.js exports (see that file's Phase 8 comment) with
// this session-derived id in place of req.params.id.

async function bootstrap(req, res) {
  const eventId = await clientAccessModel.findEventIdByToken(req.params.token);
  if (!eventId) return res.status(404).send('Link not found.');
  req.session.clientEventId = eventId;
  res.redirect('/client');
}

async function showDashboard(req, res) {
  const data = await adminController.getDashboardData(req.session.clientEventId);
  if (!data) return res.status(404).send('Link not found.');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const error = req.query.error === 'needs_date' ? 'Set a date before publishing this event.' : null;
  res.render(`admin/themes/${data.event.theme}/dashboard`, { ...data, baseUrl, error, clientMode: true });
}

async function showEditForm(req, res) {
  const data = await adminController.getEditFormData(req.session.clientEventId);
  if (!data) return res.status(404).send('Link not found.');
  const error = req.query.error ? 'Couple names/Celebrant, date, and venue are required.' : null;
  res.render('admin/edit-event', { ...data, error, clientMode: true });
}

async function showAssets(req, res) {
  const data = await adminController.getAssetsData(req.session.clientEventId);
  if (!data) return res.status(404).send('Link not found.');
  res.render('admin/assets', { ...data, clientMode: true });
}

async function updateEvent(req, res) {
  const result = await adminController.updateEventCore(req.session.clientEventId, req.body, req.file, true);
  if (!result.ok) return res.redirect('/client/edit?error=1');
  res.redirect('/client');
}

async function publish(req, res) {
  const result = await adminController.publishCore(req.session.clientEventId);
  if (!result.ok && result.reason === 'needs_date') {
    return res.redirect('/client?error=needs_date');
  }
  res.redirect('/client');
}

async function addGuests(req, res) {
  await adminController.bulkAddGuestsCore(req.session.clientEventId, req.body.guestList);
  res.redirect('/client');
}

async function uploadGalleryPhotos(req, res) {
  await adminController.uploadGalleryPhotosCore(req.session.clientEventId, req.files);
  res.redirect('/client/assets');
}

async function deleteGalleryPhoto(req, res) {
  // deleteGalleryPhotoCore's own DELETE is already scoped to
  // (eventId AND photoId) — a photoId belonging to a different event
  // simply matches no row, a safe no-op, not an error.
  await adminController.deleteGalleryPhotoCore(req.session.clientEventId, req.params.photoId);
  res.redirect('/client/assets');
}

async function uploadCameoPhoto(req, res) {
  await adminController.uploadCameoPhotoCore(req.session.clientEventId, req.file, req.body.title);
  res.redirect('/client/assets');
}

async function deleteCameoPhoto(req, res) {
  await adminController.deleteCameoPhotoCore(req.session.clientEventId, req.params.photoId);
  res.redirect('/client/assets');
}

module.exports = {
  bootstrap, showDashboard, showEditForm, showAssets, updateEvent, publish,
  addGuests, uploadGalleryPhotos, deleteGalleryPhoto, uploadCameoPhoto, deleteCameoPhoto,
};
