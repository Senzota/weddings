const pool = require('../config/db');
const { generateQrToken } = require('../utils/qrGenerator');

async function create(guestId) {
  const token = generateQrToken();
  const { rows } = await pool.query(
    `INSERT INTO gatepasses (guest_id, qr_token) VALUES ($1, $2) RETURNING *`,
    [guestId, token]
  );
  return rows[0];
}

async function findByToken(token) {
  const { rows } = await pool.query(
    `SELECT gp.*, g.name, g.event_id
     FROM gatepasses gp JOIN guests g ON g.id = gp.guest_id
     WHERE gp.qr_token = $1`,
    [token]
  );
  return rows[0];
}

// Atomic check-in: only the first scan flips checked_in; any scan after
// that increments duplicate_attempts instead of re-admitting the guest.
async function checkIn(token) {
  const { rows } = await pool.query(
    `UPDATE gatepasses SET checked_in = true, checked_in_at = now()
     WHERE qr_token = $1 AND checked_in = false
     RETURNING *`,
    [token]
  );
  if (rows[0]) return { result: 'checked_in', gatepass: rows[0] };

  const { rows: dup } = await pool.query(
    `UPDATE gatepasses SET duplicate_attempts = duplicate_attempts + 1
     WHERE qr_token = $1 RETURNING *`,
    [token]
  );
  return { result: 'duplicate', gatepass: dup[0] };
}

module.exports = { create, findByToken, checkIn };
