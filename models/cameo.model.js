const pool = require('../config/db');

async function addPhoto(eventId, imageUrl, publicId, title) {
  const { rows } = await pool.query(
    `INSERT INTO cameo_photos (event_id, image_url, public_id, title)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [eventId, imageUrl, publicId, title]
  );
  return rows[0];
}

async function findByEvent(eventId) {
  const { rows } = await pool.query(
    'SELECT * FROM cameo_photos WHERE event_id = $1 ORDER BY uploaded_at DESC',
    [eventId]
  );
  return rows;
}

async function deletePhoto(eventId, photoId) {
  const { rows } = await pool.query(
    'DELETE FROM cameo_photos WHERE id = $1 AND event_id = $2 RETURNING *',
    [photoId, eventId]
  );
  return rows[0];
}

module.exports = { addPhoto, findByEvent, deletePhoto };
