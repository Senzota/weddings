const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const eventModel = require('../models/event.model');
const inquiryModel = require('../models/inquiry.model');
const clientModel = require('../models/client.model');
const guestModel = require('../models/guest.model');
const galleryModel = require('../models/gallery.model');
const cameoModel = require('../models/cameo.model');
const { archiveAndDelete } = require('../models/archive.model');
const { AVAILABLE_THEMES, DEFAULT_THEME_BY_EVENT_TYPE, themesForEventType } = require('../config/themes');
const { ACCESS_MODES } = require('../config/accessModes');
const { EVENT_TYPES, DEFAULT_EVENT_TYPE } = require('../config/eventTypes');
const { uploadImage, deleteImage } = require('../utils/cloudinary');
const { formatEventDate } = require('../utils/formatDate');

// The theme dropdown is filtered client-side (JS) by the selected event
// type, but a request can still arrive with a mismatched pair (stale
// form state, a direct POST). Falling back to that type's default theme
// here is cheap insurance against ending up with e.g. a 'birthday' event
// rendered through a wedding theme's guest templates.
function resolveTheme(theme, eventType) {
  const type = eventType || DEFAULT_EVENT_TYPE;
  if (theme && themesForEventType(type).some((t) => t.slug === theme)) return theme;
  return DEFAULT_THEME_BY_EVENT_TYPE[type];
}

// input_20 Phase 1: a type is only ever offered in a selector once at
// least one theme is registered for it — derived here, not stored as a
// flag anywhere, so registering a real theme for e.g. 'graduation' later
// is the only step needed to make it appear everywhere at once. Today
// that's just 'wedding' and 'birthday', since those are the only two
// themesForEventType() actually returns anything for.
function activeEventTypes() {
  return EVENT_TYPES.filter((t) => themesForEventType(t.slug).length > 0);
}

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
  // input_20 Phase 9B (M-1): same session-fixation protection
  // clientAccount.controller.js's register/login already have — a fresh
  // session id is issued first, then adminId is set on that new session,
  // so a session id known before authentication can't be reused after it.
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('Something went wrong.');
    req.session.adminId = admin.id;
    res.redirect('/admin/events');
  });
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
  res.render('admin/event-form', { event: null, error: null, themes: AVAILABLE_THEMES, accessModes: ACCESS_MODES, eventTypes: activeEventTypes() });
}

async function createEvent(req, res) {
  const {
    coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, declineMessage,
    theme, accessMode, eventType, subtitle, footerNote, eventTimeNote,
  } = req.body;
  if (!coupleNames || !weddingDate || !venue) {
    return res.render('admin/event-form', { event: null, error: 'Couple names/Celebrant, date, and venue are required.', themes: AVAILABLE_THEMES, accessModes: ACCESS_MODES, eventTypes: activeEventTypes() });
  }
  // A themeless (planned-but-not-yet-active) event type must never reach
  // eventModel.create() — resolveTheme()'s fallback-to-default only makes
  // sense between themes that both belong to the SAME type; there is no
  // safe default to fall back to for a type with zero registered themes,
  // and silently substituting a different type's theme (e.g. wedding's)
  // would be exactly the silent-mapping behavior this input rules out.
  // Rejected here with a normal form error, the same way a missing
  // required field already is — not a raw 500, and not a bypass a direct
  // POST (skipping the client-side selector entirely) could sneak past.
  const requestedType = eventType || DEFAULT_EVENT_TYPE;
  if (themesForEventType(requestedType).length === 0) {
    return res.render('admin/event-form', { event: null, error: 'That event type is not available yet — no theme is registered for it.', themes: AVAILABLE_THEMES, accessModes: ACCESS_MODES, eventTypes: activeEventTypes() });
  }
  const event = await eventModel.create({
    coupleNames, weddingDate, venue,
    themeColor: themeColor || '#8a6d3b',
    acceptButtonText: acceptButtonText || 'Accept with pleasure',
    declineButtonText: declineButtonText || 'Decline with regret',
    declineMessage: declineMessage || undefined,
    theme: resolveTheme(theme, eventType), accessMode, eventType, subtitle, footerNote, eventTimeNote,
  });
  res.redirect(`/admin/events/${event.id}`);
}

// Wedding date is a plain 'YYYY-MM-DD' string (see config/db.js's type
// parser) — building the Date from an explicit local-midnight literal
// avoids the same UTC-shift bug that parser exists to prevent.
//
// input_20 Phase 2: a draft event may have no date at all. Without this
// guard, `new Date('nullT00:00:00')` is an Invalid Date and every caller
// would have rendered the literal string "NaN" in a "Days to go" stat —
// null is the signal every dashboard view checks for instead.
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  const diffMs = target.getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diffMs / 86400000));
}

// input_20 Phase 8: data-only cores (eventId in, plain data out, no
// render/response) — reused by both the admin route handlers below
// (unchanged outward behavior) and controllers/client.controller.js
// (which supplies req.session.clientEventId instead of req.params.id).
// Splitting the data fetch from the render lets both callers render with
// their own baseUrl/error/clientMode handling while sharing one fetch.
async function getDashboardData(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) return null;
  const guests = await guestModel.findByEvent(event.id);
  const stats = await eventModel.getStats(event.id);
  const galleryPhotos = await galleryModel.findByEvent(event.id);
  const cameoPhotos = await cameoModel.findByEvent(event.id);
  return {
    event, guests, stats, galleryPhotos, cameoPhotos,
    daysToGo: daysUntil(event.wedding_date), themes: AVAILABLE_THEMES,
  };
}

async function getEditFormData(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) return null;
  return { event, themes: AVAILABLE_THEMES, accessModes: ACCESS_MODES, eventTypes: activeEventTypes() };
}

async function getAssetsData(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) return null;
  const galleryPhotos = await galleryModel.findByEvent(event.id);
  const cameoPhotos = await cameoModel.findByEvent(event.id);
  return { event, galleryPhotos, cameoPhotos };
}

async function showDashboard(req, res) {
  const data = await getDashboardData(req.params.id);
  if (!data) return res.status(404).send('Wedding not found.');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // input_20 Phase 2: toggleStatus redirects back here with this query
  // param when it refuses to publish a dateless draft — surfaced the same
  // way updateEvent's own validation error already is elsewhere.
  const error = req.query.error === 'needs_date' ? 'Set a date before publishing this event.' : null;
  res.render(`admin/themes/${data.event.theme}/dashboard`, { ...data, baseUrl, error });
}

// input_20 Phase 10D: read-only admin preview of the same client-facing
// dashboard — same data core as the real admin dashboard (getDashboardData),
// same theme template, no session mutation of any kind (no clientId,
// clientEventId, or admin session change), no token lookup. clientMode is
// passed as true purely so the template reuses its existing "hide
// admin-only nav" branches; previewMode additionally suppresses every
// mutating control clientMode alone would still allow (publish, edit,
// add-guest, asset upload) — see each theme dashboard's own Phase 10D
// comment for how the two flags combine. Works identically for an
// account-linked, anonymous/token-only, or admin-created event: this only
// ever looks the event up by its own id, the same as the normal admin
// dashboard already does.
async function showClientPreview(req, res) {
  const data = await getDashboardData(req.params.id);
  if (!data) return res.status(404).send('Wedding not found.');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.render(`admin/themes/${data.event.theme}/dashboard`, {
    ...data,
    baseUrl,
    error: null,
    clientMode: true,
    previewMode: true,
    returnToAdminUrl: `/admin/events/${data.event.id}`,
  });
}

async function showEditForm(req, res) {
  const data = await getEditFormData(req.params.id);
  if (!data) return res.status(404).send('Wedding not found.');
  const error = req.query.error ? 'Couple names/Celebrant, date, and venue are required.' : null;
  res.render('admin/edit-event', { ...data, error });
}

async function showAssets(req, res) {
  const data = await getAssetsData(req.params.id);
  if (!data) return res.status(404).send('Wedding not found.');
  res.render('admin/assets', data);
}

// input_20 Phase 8: isClient forces two fields to always be ignored,
// regardless of what's in `fields` — accessMode (admin-only, never a
// client capability) and eventType (a client's event type is fixed at
// approval time; "default to preserving the original approved event
// type" per this phase's own requirement). Everything else about this
// function's validation/behavior is identical for both callers — the
// admin wrapper below calls this with isClient=false on every existing
// code path, so admin behavior is unchanged.
async function updateEventCore(eventId, fields, file, isClient) {
  const {
    coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText,
    declineMessage, itinerary, invitationMessage, contactDetails, theme, accessMode,
    eventType, subtitle, footerNote, eventTimeNote,
  } = fields;
  if (!coupleNames || !venue) return { ok: false, reason: 'validation' };

  // Needed both for Cloudinary cleanup (image-replace path) and to resolve
  // the submitted theme against the event's *current* type when a partial
  // form (e.g. Lady Gianna's "Event details" card) doesn't submit an
  // eventType of its own — falls back to the type already on record rather
  // than assuming 'wedding'.
  const existing = await eventModel.findById(eventId);
  if (!existing) return { ok: false, reason: 'not_found' };

  // Same themeless-type guard as createEvent — only fires when eventType is
  // actually being changed to something with zero registered themes (a
  // partial form that omits eventType entirely is unaffected, since it
  // isn't trying to change it). Never applies to a client call — a client
  // can never actually change eventType (below), so there's nothing here
  // for that guard to protect against for that caller.
  if (!isClient && eventType !== undefined && themesForEventType(eventType).length === 0) {
    return { ok: false, reason: 'validation' };
  }

  let cardImage;
  let cardImagePublicId;
  if (file) {
    const result = await uploadImage(file.buffer, `weddings103/events/${eventId}`);
    cardImage = result.secure_url;
    cardImagePublicId = result.public_id;

    // Best-effort cleanup of the image this one replaces — don't leave it
    // orphaned on Cloudinary, but don't let a delete failure block the
    // update that already succeeded.
    if (existing.card_image_public_id) {
      deleteImage(existing.card_image_public_id).catch((err) => {
        console.error(`Failed to delete replaced Cloudinary image ${existing.card_image_public_id}:`, err);
      });
    }
  }

  // Only resolve/clamp the theme when one was actually submitted — a
  // partial form omitting `theme` entirely must leave it untouched
  // (eventModel.update's COALESCE), not silently reset it to that type's
  // default. A client's choice is validated against the event's own,
  // unchangeable event_type — never against a submitted (and, for a
  // client, always-ignored) eventType value.
  const resolvedTheme = theme !== undefined
    ? resolveTheme(theme, isClient ? existing.event_type : (eventType || existing.event_type))
    : undefined;

  await eventModel.update(eventId, {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage, cardImage, cardImagePublicId,
    itinerary, invitationMessage, contactDetails, theme: resolvedTheme,
    accessMode: isClient ? undefined : accessMode,
    eventType: isClient ? undefined : eventType,
    subtitle, footerNote, eventTimeNote,
  });
  return { ok: true };
}

async function updateEvent(req, res) {
  // The dedicated edit page, Botanical Bloom's inline dashboard form, and
  // Lady Gianna's smaller "Event details" card all post here — redirecting
  // to the edit page on failure (rather than re-rendering whichever page
  // submitted) keeps this one handler simple; browsers already block
  // empty required fields client-side, so this path is rare.
  //
  // input_20 Phase 2: weddingDate is deliberately NOT required here,
  // unlike createEvent's check below it stays out of — a booking-approved
  // draft event starts with no date at all, and every update path (the
  // full edit form, Botanical Bloom's inline form, Lady Gianna's smaller
  // cards) must be able to save every *other* field on such an event
  // without being blocked for a date nothing has collected yet. Manually
  // creating a new event still requires one, unchanged, in createEvent.
  // Preserves the exact original behavior for a nonexistent id: this
  // never 404s here (unlike the client wrapper) — it falls through to the
  // same redirect a validation failure gets, same as before this
  // function was split into a core (eventModel.update on a missing id was
  // always a harmless no-op, and the subsequent dashboard redirect below
  // was always what actually surfaced the 404, via showDashboard's own
  // check — unchanged).
  const result = await updateEventCore(req.params.id, req.body, req.file, false);
  if (!result.ok) return res.redirect(`/admin/events/${req.params.id}/edit?error=1`);
  res.redirect(`/admin/events/${req.params.id}`);
}

// input_20 Phase 8: split so a client can be handed a safe, exported
// draft->live-only function with no way to ever also reach the
// live->draft direction — that direction (unpublishCore) stays private
// to this file, reachable only from toggleStatus below. Not a runtime
// permission check: there is no unpublish function for a client
// controller to even import, so there is no reachable code path for it
// to call regardless of what any request contains.
async function publishCore(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) return { ok: false, reason: 'not_found' };
  if (event.status === 'live') return { ok: true, event }; // already live: no-op, not an error
  // input_20 Phase 2: the database's own events_live_requires_date CHECK
  // constraint is the hard backstop for this same rule (schema.sql); this
  // is the friendly, expected-path guard that keeps a normal request from
  // ever reaching that constraint at all — identical for both the admin
  // and client callers.
  if (!event.wedding_date) return { ok: false, reason: 'needs_date' };
  const updated = await eventModel.setStatus(event.id, 'live');
  return { ok: true, event: updated };
}

async function unpublishCore(eventId) {
  const event = await eventModel.findById(eventId);
  if (!event) return { ok: false, reason: 'not_found' };
  if (event.status === 'draft') return { ok: true, event }; // already draft: no-op
  const updated = await eventModel.setStatus(event.id, 'draft');
  return { ok: true, event: updated };
}

async function toggleStatus(req, res) {
  const event = await eventModel.findById(req.params.id);
  if (!event) return res.status(404).send('Wedding not found.');
  if (event.status === 'live') {
    await unpublishCore(req.params.id);
  } else {
    const result = await publishCore(req.params.id);
    if (!result.ok && result.reason === 'needs_date') {
      return res.redirect(`/admin/events/${req.params.id}?error=needs_date`);
    }
  }
  res.redirect(`/admin/events/${req.params.id}`);
}

// input_20 Phase 9B (L-1/L-3): shared numeric-id + existence guard for the
// five write-only mutation cores below. Every *read*-first core above
// (getDashboardData et al.) already gets this for free via
// eventModel.findById's own numeric guard — these five didn't, because
// they never needed to load the event itself before this fix, only its
// id. A malformed :id (admin) or a stale clientEventId left over after an
// admin deletes the event (client) both now resolve to the same clean
// not-found result these functions' siblings already give, instead of a
// raw Postgres integer-cast/FK-violation error. Checked before any
// Cloudinary call or database write, so an invalid/stale id never uploads
// an orphaned asset or writes a row for an event that doesn't exist.
async function findEventForMutation(eventId) {
  if (!/^\d+$/.test(String(eventId))) return undefined;
  return eventModel.findById(eventId);
}

// Bulk-add guests from pasted "Name, seat count[, invite group]" lines,
// one guest per line — invite group (input_15 §A7) is optional and purely
// descriptive, so a line with just "Name, seat count" still works exactly
// as it did before this field existed.
async function bulkAddGuestsCore(eventId, guestListRaw) {
  const event = await findEventForMutation(eventId);
  if (!event) return { ok: false, reason: 'not_found' };

  const lines = (guestListRaw || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const entries = lines.map((line) => {
    const [name, seatCountRaw, inviteGroupRaw] = line.split(',').map((part) => part.trim());
    const seatCount = parseInt(seatCountRaw, 10);
    return {
      name,
      seatCount: Number.isFinite(seatCount) && seatCount > 0 ? seatCount : 1,
      inviteGroup: inviteGroupRaw || null,
    };
  }).filter((entry) => entry.name);

  if (entries.length > 0) {
    await guestModel.bulkCreate(eventId, entries);
  }
  return { ok: true };
}

async function bulkAddGuests(req, res) {
  const result = await bulkAddGuestsCore(req.params.id, req.body.guestList);
  if (!result.ok) return res.status(404).send('Wedding not found.');
  res.redirect(`/admin/events/${req.params.id}`);
}

async function deleteEvent(req, res) {
  const archived = await archiveAndDelete(req.params.id);
  if (!archived) return res.status(404).send('Wedding not found.');
  res.redirect('/admin/events');
}

// One or more photos in a single request (upload.array).
async function uploadGalleryPhotosCore(eventId, files) {
  const event = await findEventForMutation(eventId);
  if (!event) return { ok: false, reason: 'not_found' };

  for (const file of (files || [])) {
    const result = await uploadImage(file.buffer, `weddings103/events/${eventId}/gallery`);
    await galleryModel.addPhoto(eventId, result.secure_url, result.public_id);
  }
  return { ok: true };
}

async function uploadGalleryPhotos(req, res) {
  const result = await uploadGalleryPhotosCore(req.params.id, req.files);
  if (!result.ok) return res.status(404).send('Wedding not found.');
  res.redirect(`/admin/events/${req.params.id}/assets`);
}

async function deleteGalleryPhotoCore(eventId, photoId) {
  const event = await findEventForMutation(eventId);
  if (!event) return { ok: false, reason: 'not_found' };

  const photo = await galleryModel.deletePhoto(eventId, photoId);
  if (photo) {
    try {
      await deleteImage(photo.public_id);
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${photo.public_id}:`, err);
    }
  }
  return { ok: true };
}

async function deleteGalleryPhoto(req, res) {
  const result = await deleteGalleryPhotoCore(req.params.id, req.params.photoId);
  if (!result.ok) return res.status(404).send('Wedding not found.');
  res.redirect(`/admin/events/${req.params.id}/assets`);
}

// Cameos are uploaded one at a time with a title, unlike Gallery's
// multi-file batch — each entry is meant to carry its own caption.
async function uploadCameoPhotoCore(eventId, file, title) {
  const event = await findEventForMutation(eventId);
  if (!event) return { ok: false, reason: 'not_found' };

  if (file) {
    const result = await uploadImage(file.buffer, `weddings103/events/${eventId}/cameos`);
    await cameoModel.addPhoto(eventId, result.secure_url, result.public_id, title || null);
  }
  return { ok: true };
}

async function uploadCameoPhoto(req, res) {
  const result = await uploadCameoPhotoCore(req.params.id, req.file, req.body.title);
  if (!result.ok) return res.status(404).send('Wedding not found.');
  res.redirect(`/admin/events/${req.params.id}/assets`);
}

async function deleteCameoPhotoCore(eventId, photoId) {
  const event = await findEventForMutation(eventId);
  if (!event) return { ok: false, reason: 'not_found' };

  const photo = await cameoModel.deletePhoto(eventId, photoId);
  if (photo) {
    try {
      await deleteImage(photo.public_id);
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${photo.public_id}:`, err);
    }
  }
  return { ok: true };
}

async function deleteCameoPhoto(req, res) {
  const result = await deleteCameoPhotoCore(req.params.id, req.params.photoId);
  if (!result.ok) return res.status(404).send('Wedding not found.');
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
    { header: 'Invitation Type', key: 'inviteGroup', width: 25 },
    { header: 'Seats', key: 'seats', width: 10 },
    { header: 'Passcode', key: 'passcode', width: 15 },
    { header: 'RSVP Status', key: 'rsvp', width: 15 },
    { header: 'Checked In', key: 'checkedIn', width: 12 },
  ];
  for (const guest of guests) {
    sheet.addRow({
      name: guest.name,
      inviteGroup: guest.invite_group || '',
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

// input_20 Phase 6: read-only admin inquiries list/detail. No approve/
// decline yet (Phase 7) — every row is 'new' at this phase.
function eventTypeLabel(slug) {
  const match = EVENT_TYPES.find((t) => t.slug === slug);
  return match ? match.label : slug;
}
function themeLabel(slug) {
  const match = AVAILABLE_THEMES.find((t) => t.slug === slug);
  return match ? match.label : slug;
}

async function listInquiries(req, res) {
  const inquiries = await inquiryModel.findAll();
  const rows = inquiries.map((inquiry) => ({
    ...inquiry,
    event_type_label: eventTypeLabel(inquiry.event_type),
    preferred_theme_label: inquiry.preferred_theme ? themeLabel(inquiry.preferred_theme) : null,
  }));
  res.render('admin/inquiries-list', { inquiries: rows });
}

async function showInquiryDetail(req, res) {
  const inquiry = await inquiryModel.findById(req.params.id);
  if (!inquiry) return res.status(404).send('Inquiry not found.');
  // input_20 Phase 7: approveInquiry/declineInquiry redirect back here with
  // this query param when the atomic claim inside inquiryModel.approve()/
  // decline() finds the inquiry already decided — same ?error=<code>
  // convention as toggleStatus's ?error=needs_date.
  const error = req.query.error === 'already_decided' ? 'This inquiry was already decided.' : null;
  res.render('admin/inquiry-detail', {
    inquiry,
    error,
    eventTypeLabel: eventTypeLabel(inquiry.event_type),
    preferredThemeLabel: inquiry.preferred_theme ? themeLabel(inquiry.preferred_theme) : null,
  });
}

async function approveInquiry(req, res) {
  const result = await inquiryModel.approve(req.params.id, req.session.adminId);
  if (result.reason === 'not_found') return res.status(404).send('Inquiry not found.');
  if (!result.ok) return res.redirect(`/admin/inquiries/${req.params.id}?error=already_decided`);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // input_20 Phase 7: this /client/<token> link is not a working route
  // yet — that bootstrap route belongs to Phase 8. Shown here anyway,
  // per this phase's own scope, because the token/hash pairing it points
  // at is already stored in exactly the shape Phase 8 will need to
  // validate it; only the route that reads it doesn't exist yet.
  res.render('admin/inquiry-approved', {
    inquiry: result.inquiry,
    event: result.event,
    clientLink: `${baseUrl}/client/${result.rawToken}`,
  });
}

async function declineInquiry(req, res) {
  const result = await inquiryModel.decline(req.params.id, req.session.adminId);
  if (result.reason === 'not_found') return res.status(404).send('Inquiry not found.');
  if (!result.ok) return res.redirect(`/admin/inquiries/${req.params.id}?error=already_decided`);
  res.redirect(`/admin/inquiries/${req.params.id}`);
}

// input_20 Phase 11B: same naming convention as
// clientAccount.controller.js's own eventDisplayTitle (duplicated for the
// same reason eventTypeLabel/themeLabel above are duplicated rather than
// imported — that file isn't a shared module either way) — a title built
// only from fields this page is already allowed to show, never an
// internal id: couple_names as-is for a wedding-style event, "X's
// Birthday" for a birthday, a safe type-label fallback when couple_names
// is empty.
function eventDisplayTitle(event) {
  const name = (event.couple_names || '').trim();
  if (!name) return `${eventTypeLabel(event.event_type)} Celebration`;
  if (event.event_type === 'birthday') return `${name}'s Birthday`;
  return name;
}

// input_20 Phase 11B: read-only admin client directory. listClients passes
// through exactly what clientModel.findAllWithCounts() already returns
// (id/full_name/email/phone/created_at/event_count/pending_inquiry_count)
// — no password_hash, no token/session data ever leaves that query in the
// first place, so there's nothing further to strip here.
async function listClients(req, res) {
  const clients = await clientModel.findAllWithCounts();
  res.render('admin/clients-list', { clients });
}

async function showClientDetail(req, res) {
  const client = await clientModel.findById(req.params.id);
  if (!client) return res.status(404).send('Client not found.');

  const [events, pendingInquiries] = await Promise.all([
    eventModel.findAllByClientIdForAdmin(client.id),
    inquiryModel.findPendingByClientId(client.id),
  ]);

  const ownedEvents = events.map((event) => ({
    id: event.id,
    typeLabel: eventTypeLabel(event.event_type),
    title: eventDisplayTitle(event),
    dateLabel: event.wedding_date ? formatEventDate(event.wedding_date) : 'To be confirmed',
    themeLabel: themeLabel(event.theme),
    statusLabel: event.status === 'live' ? 'Live' : 'Draft',
  }));

  const pendingList = pendingInquiries.map((inquiry) => ({
    id: inquiry.id,
    typeLabel: eventTypeLabel(inquiry.event_type),
    preferredThemeLabel: inquiry.preferred_theme ? themeLabel(inquiry.preferred_theme) : null,
    createdAt: inquiry.created_at,
  }));

  res.render('admin/client-detail', { client, ownedEvents, pendingList });
}

module.exports = {
  showLogin, login, logout,
  listEvents, newEventForm, createEvent,
  showDashboard, showEditForm, showAssets, updateEvent, toggleStatus, bulkAddGuests, deleteEvent,
  exportGuestList, uploadGalleryPhotos, deleteGalleryPhoto,
  uploadCameoPhoto, deleteCameoPhoto,
  showClientPreview,
  listInquiries, showInquiryDetail, approveInquiry, declineInquiry,
  listClients, showClientDetail,
  // input_20 Phase 8: data-only cores + eventId-taking action cores, for
  // controllers/client.controller.js to call with req.session.clientEventId
  // in place of req.params.id. unpublishCore is deliberately never
  // exported — there is no client-reachable path to it anywhere.
  getDashboardData, getEditFormData, getAssetsData,
  updateEventCore, bulkAddGuestsCore,
  uploadGalleryPhotosCore, deleteGalleryPhotoCore,
  uploadCameoPhotoCore, deleteCameoPhotoCore,
  publishCore,
};
