const pool = require('../config/db');

// input_20 Phase 5: only the minimal create operation this phase needs.
// Listing (Phase 6), approve/decline (Phase 7), and token issuance
// (Phase 8) are deliberately not implemented here yet.
async function create(fields) {
  const { fullName, phone, email, eventType, preferredTheme, note } = fields;
  const { rows } = await pool.query(
    `INSERT INTO booking_inquiries (full_name, phone, email, event_type, preferred_theme, note)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [fullName, phone, email, eventType, preferredTheme || null, note || null]
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

module.exports = { create, findAll, findById };
