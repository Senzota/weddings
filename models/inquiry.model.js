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

module.exports = { create };
