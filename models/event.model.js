const pool = require('../config/db');

const DEFAULT_DECLINE_MESSAGE = "Thank you for letting us know. You are always welcome — if your plans change, we'd love to have you with us.";

async function create(fields) {
  const {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage,
  } = fields;
  const { rows } = await pool.query(
    `INSERT INTO events (couple_names, wedding_date, venue, theme_color, accept_button_text, decline_button_text, decline_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, declineMessage || DEFAULT_DECLINE_MESSAGE]
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

async function update(id, fields) {
  const {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, declineMessage, cardImage,
  } = fields;
  const { rows } = await pool.query(
    `UPDATE events SET
       couple_names = $1, wedding_date = $2, venue = $3,
       theme_color = COALESCE($4, theme_color),
       accept_button_text = COALESCE($5, accept_button_text),
       decline_button_text = COALESCE($6, decline_button_text),
       decline_message = COALESCE($7, decline_message),
       card_image = COALESCE($8, card_image)
     WHERE id = $9 RETURNING *`,
    [coupleNames, weddingDate, venue, themeColor || null, acceptButtonText || null, declineButtonText || null, declineMessage || null, cardImage, id]
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

module.exports = { create, findAll, findById, update, setStatus, getStats };
