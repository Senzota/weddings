const pool = require('../config/db');

async function addPhoto(eventId, imageUrl, publicId) {
  const { rows } = await pool.query(
    `INSERT INTO gallery_photos (event_id, image_url, public_id)
     VALUES ($1, $2, $3) RETURNING *`,
    [eventId, imageUrl, publicId]
  );
  return rows[0];
}

async function findByEvent(eventId) {
  const { rows } = await pool.query(
    'SELECT * FROM gallery_photos WHERE event_id = $1 ORDER BY uploaded_at DESC',
    [eventId]
  );
  return rows;
}

// Returns the deleted row (so the caller has public_id for the Cloudinary
// cleanup) scoped to eventId, so one event's admin can't delete another
// event's photo by guessing an id.
async function deletePhoto(eventId, photoId) {
  const { rows } = await pool.query(
    'DELETE FROM gallery_photos WHERE id = $1 AND event_id = $2 RETURNING *',
    [photoId, eventId]
  );
  return rows[0];
}

module.exports = { addPhoto, findByEvent, deletePhoto };
