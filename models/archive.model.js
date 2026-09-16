const pool = require('../config/db');
const { deleteImage } = require('../utils/cloudinary');

// Archives anonymous summary metrics, then deletes the event (guests,
// gatepasses, and gallery_photos rows cascade via their FK constraints).
// Both steps run in one transaction: if the archive write fails, nothing
// is deleted — no guest data disappears without the metrics surviving it
// first. Cloudinary cleanup (the card image + every gallery photo) runs
// only after that transaction commits, and is best-effort: a failed
// Cloudinary delete is logged, never lets a leftover remote image block
// or roll back the database deletion that already succeeded.
async function archiveAndDelete(eventId) {
  if (!/^\d+$/.test(String(eventId))) return null;

  const client = await pool.connect();
  let archived;
  let imagePublicIds = [];
  try {
    await client.query('BEGIN');

    const { rows: eventRows } = await client.query(
      'SELECT * FROM events WHERE id = $1 FOR UPDATE', [eventId]
    );
    const event = eventRows[0];
    if (!event) {
      await client.query('ROLLBACK');
      return null;
    }
    if (event.card_image_public_id) imagePublicIds.push(event.card_image_public_id);

    const { rows: galleryRows } = await client.query(
      'SELECT public_id FROM gallery_photos WHERE event_id = $1', [eventId]
    );
    imagePublicIds.push(...galleryRows.map((r) => r.public_id));

    const { rows: statRows } = await client.query(
      `SELECT
         COUNT(*) AS total_guests,
         COALESCE(SUM(seat_count), 0) AS total_seats,
         COUNT(*) FILTER (WHERE rsvp_status = 'accepted') AS accepted_count,
         COUNT(*) FILTER (WHERE rsvp_status = 'declined') AS declined_count,
         COUNT(*) FILTER (WHERE rsvp_status = 'pending') AS pending_count,
         COALESCE(SUM(seat_count) FILTER (WHERE rsvp_status = 'accepted'), 0) AS seats_accepted,
         (SELECT COUNT(*) FROM gatepasses gp JOIN guests gu ON gu.id = gp.guest_id
            WHERE gu.event_id = $1 AND gp.checked_in) AS checked_in_count
       FROM guests WHERE event_id = $1`,
      [eventId]
    );
    const s = statRows[0];
    const totalGuests = Number(s.total_guests);
    const acceptedCount = Number(s.accepted_count);
    const responseRate = totalGuests > 0
      ? (acceptedCount + Number(s.declined_count)) / totalGuests
      : null;
    const attendanceRate = acceptedCount > 0
      ? Number(s.checked_in_count) / acceptedCount
      : null;

    const { rows: archiveRows } = await client.query(
      `INSERT INTO event_archive (
         couple_names, wedding_date, venue, total_guests, total_seats,
         accepted_count, declined_count, pending_count, seats_accepted,
         checked_in_count, response_rate, attendance_rate, event_created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        event.couple_names, event.wedding_date, event.venue,
        totalGuests, Number(s.total_seats),
        acceptedCount, Number(s.declined_count), Number(s.pending_count),
        Number(s.seats_accepted), Number(s.checked_in_count),
        responseRate, attendanceRate, event.created_at,
      ]
    );

    await client.query('DELETE FROM events WHERE id = $1', [eventId]);

    await client.query('COMMIT');
    archived = archiveRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  for (const publicId of imagePublicIds) {
    try {
      await deleteImage(publicId);
    } catch (err) {
      console.error(`Failed to delete Cloudinary image ${publicId} for deleted event ${eventId}:`, err);
    }
  }

  return archived;
}

module.exports = { archiveAndDelete };
