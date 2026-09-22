const pool = require('../config/db');
const { DEFAULT_THEME } = require('../config/themes');
const { DEFAULT_ACCESS_MODE } = require('../config/accessModes');
const { DEFAULT_EVENT_TYPE } = require('../config/eventTypes');

const DEFAULT_DECLINE_MESSAGE = "Thank you for letting us know. You are always welcome — if your plans change, we'd love to have you with us.";

async function create(fields) {
  const {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage, theme, accessMode,
    eventType, subtitle, footerNote, eventTimeNote,
  } = fields;
  // input_20 Phase 2: wedding_date needs no special handling here — this is
  // always a fresh row, so there's no existing value to accidentally erase.
  // The admin's own "add new event" form still requires a date before this
  // is ever called (createEvent's controller-level check, unchanged); a
  // caller that legitimately wants a dateless draft can pass `null`/
  // `undefined` directly and it inserts as SQL NULL, same as `pg` already
  // does for every other optional field in this function.
  const { rows } = await pool.query(
    `INSERT INTO events (couple_names, wedding_date, venue, theme_color, accept_button_text, decline_button_text, decline_message, theme, access_mode, event_type, subtitle, footer_note, event_time_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, declineMessage || DEFAULT_DECLINE_MESSAGE, theme || DEFAULT_THEME, accessMode || DEFAULT_ACCESS_MODE, eventType || DEFAULT_EVENT_TYPE, subtitle || null, footerNote || null, eventTimeNote || null]
  );
  return rows[0];
}

async function findAll() {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY wedding_date ASC');
  return rows;
}

async function findById(id) {
  // id is a serial integer column — anything non-numeric (a stray/old
  // link, a typo) would otherwise reach Postgres as "invalid input syntax
  // for type integer" instead of a normal not-found.
  if (!/^\d+$/.test(String(id))) return undefined;
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  return rows[0];
}

// input_20 Phase 10C.1: replaces Phase 10C's single-event findByClientId
// (no remaining caller as of this phase — both of its call sites, in
// clientAccount.controller.js, are updated below) now that the dashboard
// must show every event a client owns, not just the most recent one.
// Ownership comes solely from clients.id, never from any request-supplied
// event identifier.
async function findAllByClientId(clientId) {
  const { rows } = await pool.query(
    `SELECT * FROM events
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

// input_20 Phase 10C.1: the ownership-scoped lookup POST /client/select-event
// needs now that a client picks among possibly several owned events — the
// submitted eventId is a selection hint only, never authority, so this is
// the one place that decides whether it actually belongs to this client.
// Same numeric guard as findById (a forged/malformed id must never reach
// Postgres as a syntax error), plus the client_id match in the same query
// rather than as a separate check, so there is no window where an id is
// treated as "found" before ownership is confirmed.
async function findByIdAndClientId(eventId, clientId) {
  if (!/^\d+$/.test(String(eventId))) return undefined;
  const { rows } = await pool.query(
    'SELECT * FROM events WHERE id = $1 AND client_id = $2',
    [eventId, clientId]
  );
  return rows[0];
}

// Undefined means "this form doesn't know about this field at all" (e.g.
// Lady Gianna's dashboard "Event details" card only submits a handful of
// fields) — that must leave the column untouched via COALESCE. An
// explicit empty string means "the admin cleared this field" and must go
// through as-is. Only `undefined` collapses to NULL here; '' does not.
function absentToNull(value) {
  return value === undefined ? null : value;
}

async function update(id, fields) {
  const {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage, cardImage, cardImagePublicId,
    itinerary, invitationMessage, contactDetails, theme, accessMode,
    eventType, subtitle, footerNote, eventTimeNote,
  } = fields;
  // input_20 Phase 2: wedding_date deliberately does NOT use absentToNull()'s
  // rule (explicit '' = clear it) — a date has no meaningful "cleared but not
  // null" state the way a text field does, and there's no path in this app
  // that should ever take an already-dated event back to dateless through an
  // ordinary save. NULLIF($2, '') turns both "field absent" (pg already turns
  // `undefined` into SQL NULL) and "field present but empty" (e.g. a
  // dateless draft's own hidden/hidden-equivalent date input, or a form that
  // simply hasn't collected one yet) into NULL, and COALESCE then always
  // falls back to preserving whatever's already on the row — so neither case
  // can ever attempt an invalid empty-string-to-date cast, and neither case
  // can ever silently erase a real date that's already set. A genuine new
  // date value passes through unchanged and updates the row normally.
  // The explicit ::date cast is required — without it Postgres resolves
  // NULLIF($2, '') as text (both operands are otherwise untyped) and then
  // fails with "COALESCE types text and date cannot be matched" against
  // the date column, even though $2 itself always holds a valid date
  // string or ''. Found via local testing (a real bug, not theoretical).
  const { rows } = await pool.query(
    `UPDATE events SET
       couple_names = $1,
       wedding_date = COALESCE(NULLIF($2, '')::date, wedding_date),
       venue = $3,
       theme_color = COALESCE($4, theme_color),
       accept_button_text = COALESCE($5, accept_button_text),
       decline_button_text = COALESCE($6, decline_button_text),
       decline_message = COALESCE($7, decline_message),
       card_image = COALESCE($8, card_image),
       card_image_public_id = COALESCE($9, card_image_public_id),
       itinerary = COALESCE($10, itinerary),
       invitation_message = COALESCE($11, invitation_message),
       contact_details = COALESCE($12, contact_details),
       theme = COALESCE($13, theme),
       access_mode = COALESCE($14, access_mode),
       event_type = COALESCE($15, event_type),
       subtitle = COALESCE($16, subtitle),
       footer_note = COALESCE($17, footer_note),
       event_time_note = COALESCE($18, event_time_note)
     WHERE id = $19 RETURNING *`,
    [
      coupleNames, weddingDate, venue,
      themeColor || null, acceptButtonText || null, declineButtonText || null, declineMessage || null,
      cardImage, cardImagePublicId,
      absentToNull(itinerary), absentToNull(invitationMessage), absentToNull(contactDetails),
      theme || null, accessMode || null, eventType || null,
      absentToNull(subtitle), absentToNull(footerNote), absentToNull(eventTimeNote),
      id,
    ]
  );
  return rows[0];
}

async function setStatus(id, status) {
  const { rows } = await pool.query(
    'UPDATE events SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0];
}

async function getStats(id) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE rsvp_status != 'pending') AS responded,
       COUNT(*) FILTER (WHERE rsvp_status = 'accepted') AS accepted,
       COUNT(*) FILTER (WHERE rsvp_status = 'declined') AS declined,
       COALESCE(SUM(seat_count) FILTER (WHERE rsvp_status = 'accepted'), 0) AS seats_accepted,
       COUNT(*) AS total_guests,
       (SELECT COUNT(*) FROM gatepasses g JOIN guests gu ON gu.id = g.guest_id
          WHERE gu.event_id = $1 AND g.checked_in) AS checked_in
     FROM guests WHERE event_id = $1`,
    [id]
  );
  return rows[0];
}

module.exports = { create, findAll, findById, update, setStatus, getStats, findAllByClientId, findByIdAndClientId };
