const crypto = require('crypto');
const pool = require('../config/db');
const { themesForEventType, DEFAULT_THEME_BY_EVENT_TYPE } = require('../config/themes');

// input_20 Phase 5: only the minimal create operation this phase needs.
// Listing (Phase 6), approve/decline (Phase 7), and token issuance
// (Phase 8) are deliberately not implemented here yet.
// input_20 Phase 10B: clientId is an additive, optional field — the caller
// (controllers/public.controller.js) derives it from req.session.clientId
// only, never from request body/query, and passes NULL for an anonymous
// visitor. Nothing about validation or the existing insert shape changes.
async function create(fields) {
  const { fullName, phone, email, eventType, preferredTheme, note, clientId } = fields;
  const { rows } = await pool.query(
    `INSERT INTO booking_inquiries (full_name, phone, email, event_type, preferred_theme, note, client_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [fullName, phone, email, eventType, preferredTheme || null, note || null, clientId || null]
  );
  return rows[0];
}

// input_20 Phase 6: read-only admin list/detail. Newest first — the
// natural triage order for "what came in," same reasoning as every row
// being 'new' at this phase (approve/decline doesn't exist until Phase 7).
async function findAll() {
  const { rows } = await pool.query('SELECT * FROM booking_inquiries ORDER BY created_at DESC');
  return rows;
}

// Same guard as event.model.js's findById — id is a serial integer
// column, so anything non-numeric would otherwise reach Postgres as
// "invalid input syntax for type integer" instead of a normal not-found.
async function findById(id) {
  if (!/^\d+$/.test(String(id))) return undefined;
  const { rows } = await pool.query('SELECT * FROM booking_inquiries WHERE id = $1', [id]);
  return rows[0];
}

// input_20 Phase 7: decline — no transaction needed beyond the single
// atomic statement itself (same "only the first request wins" idiom as
// gatepass.model.js's checkIn: WHERE status = 'new' can only ever succeed
// once, regardless of how many requests race it). A pre-check via
// findById lets the caller tell "no such inquiry" (404) apart from
// "already decided" (redirect with a message) — the second, authoritative
// check is the UPDATE's own WHERE clause, so a race between the two only
// ever makes the classification more accurate, never less safe: if the
// row existed at the pre-check but was already decided by the time the
// UPDATE runs, that's still correctly "already decided," not "not found."
async function decline(id, adminId) {
  const existing = await findById(id);
  if (!existing) return { ok: false, reason: 'not_found' };

  const { rows } = await pool.query(
    `UPDATE booking_inquiries SET status = 'declined', decided_at = now(), decided_by = $1
     WHERE id = $2 AND status = 'new' RETURNING *`,
    [adminId, id]
  );
  if (!rows[0]) return { ok: false, reason: 'already_decided' };
  return { ok: true, inquiry: rows[0] };
}

// input_20 Phase 7: approve — claim-then-act, same shape as
// archive.model.js's archiveAndDelete (the only other explicit
// BEGIN/COMMIT/ROLLBACK transaction in this codebase): the UPDATE ...
// WHERE status = 'new' is the atomic claim (same "only the first request
// wins" idiom as gatepass.model.js's checkIn, now run inside a
// transaction because there's follow-up work — the event and token
// inserts — that must commit or roll back together with it). Two
// concurrent approve requests for the same inquiry can never both pass
// this UPDATE: Postgres serializes concurrent writers to the same row,
// so the second transaction's UPDATE simply affects 0 rows once the
// first has committed, and this function reports "already decided"
// rather than creating a second event or token.
async function approve(id, adminId) {
  if (!/^\d+$/.test(String(id))) return { ok: false, reason: 'not_found' };
  const existing = await findById(id);
  if (!existing) return { ok: false, reason: 'not_found' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: claimed } = await client.query(
      `UPDATE booking_inquiries SET status = 'approved', decided_at = now(), decided_by = $1
       WHERE id = $2 AND status = 'new' RETURNING *`,
      [adminId, id]
    );
    const inquiry = claimed[0];
    if (!inquiry) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already_decided' };
    }

    // Same "never a fallback theme for a themeless type, never an
    // unrelated theme" rule admin.controller.js's resolveTheme() already
    // enforces for manual event creation, applied here with the claimed
    // row's own values: a preferred theme is used only if it actually
    // belongs to this event type; otherwise this type's own established
    // default theme is used. inquiry.event_type can only ever be one of
    // the 9 registry slugs (booking_inquiries' own CHECK constraint), and
    // by the time any inquiry reaches this table it can only ever hold an
    // ACTIVE type — public.controller.js's createInquiry already rejects
    // an inactive type before insert (Phase 5) — so themesForEventType()
    // is guaranteed non-empty here, and DEFAULT_THEME_BY_EVENT_TYPE[...]
    // is guaranteed to resolve to a real, already-registered theme for
    // this exact type. events.theme is NOT NULL with no way to store "no
    // theme" (confirmed by inspecting db/schema.sql directly) — this
    // default-theme fallback is the narrowest change consistent with that
    // constraint and with this project's existing active-theme rules.
    const theme = (inquiry.preferred_theme
      && themesForEventType(inquiry.event_type).some((t) => t.slug === inquiry.preferred_theme))
      ? inquiry.preferred_theme
      : DEFAULT_THEME_BY_EVENT_TYPE[inquiry.event_type];

    // couple_names/venue start as placeholder text the admin or client
    // fills in properly later, same reasoning as wedding_date starting
    // genuinely NULL (Phase 2) rather than a placeholder date: nothing
    // about a booking inquiry collects a venue, and full_name is exactly
    // the value this column already holds for a manually-created event
    // (a person's name, regardless of event type — see config/
    // eventTypes.js's titleLabel field, which only changes the *label*
    // shown for this same column, never what's stored in it).
    // input_20 Phase 10B: carries the claimed inquiry's own client_id (set,
    // if at all, only at submission time from req.session.clientId — see
    // public.controller.js) straight onto the event it becomes, inside this
    // same transaction. Never re-derived from email or any other request
    // data here — the inquiry row is the only source of truth, and an
    // anonymous inquiry's NULL client_id simply carries through as NULL.
    const { rows: eventRows } = await client.query(
      `INSERT INTO events (couple_names, wedding_date, venue, event_type, theme, status, client_id)
       VALUES ($1, NULL, $2, $3, $4, 'draft', $5) RETURNING *`,
      [inquiry.full_name, 'Venue to be confirmed', inquiry.event_type, theme, inquiry.client_id]
    );
    const event = eventRows[0];

    await client.query('UPDATE booking_inquiries SET event_id = $1 WHERE id = $2', [event.id, inquiry.id]);

    // Raw token generated in the application layer (pure computation, no
    // DB round-trip needed for randomness) and only ever written to the
    // database as its hash, inside the same transaction as the event it
    // belongs to — a rolled-back transaction never leaves an orphaned
    // token, and the raw value itself never touches the database at all.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await client.query(
      'INSERT INTO client_access (event_id, token_hash) VALUES ($1, $2)',
      [event.id, tokenHash]
    );

    await client.query('COMMIT');
    return { ok: true, inquiry, event, rawToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { create, findAll, findById, approve, decline };
