const pool = require('../config/db');

async function create(fields) {
  const {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText,
  } = fields;
  const { rows } = await pool.query(
    `INSERT INTO events (couple_names, wedding_date, venue, theme_color, accept_button_text, decline_button_text)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText]
  );
  return rows[0];
}

async function findAll() {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY wedding_date ASC');
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
  return rows[0];
}

async function update(id, fields) {
  const {
    coupleNames, weddingDate, venue, themeColor,
    acceptButtonText, declineButtonText, cardImage,
  } = fields;
  const { rows } = await pool.query(
    `UPDATE events SET
       couple_names = $1, wedding_date = $2, venue = $3, theme_color = $4,
       accept_button_text = $5, decline_button_text = $6,
       card_image = COALESCE($7, card_image)
     WHERE id = $8 RETURNING *`,
    [coupleNames, weddingDate, venue, themeColor, acceptButtonText, declineButtonText, cardImage, id]
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
