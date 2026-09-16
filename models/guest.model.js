const pool = require('../config/db');
const { generatePasscode } = require('../utils/passcode');

async function bulkCreate(eventId, entries) {
  // entries: [{ name, seatCount }]
  const created = [];
  for (const { name, seatCount } of entries) {
    let passcode = generatePasscode();
    // Passcodes are globally unique; retry on the rare collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows: existing } = await pool.query(
        'SELECT 1 FROM guests WHERE passcode = $1', [passcode]
      );
      if (existing.length === 0) break;
      passcode = generatePasscode();
    }
    const { rows } = await pool.query(
      `INSERT INTO guests (event_id, name, seat_count, passcode)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [eventId, name, seatCount || 1, passcode]
    );
    created.push(rows[0]);
  }
  return created;
}

async function findByEvent(eventId) {
  const { rows } = await pool.query(
    `SELECT g.*, gp.checked_in, gp.checked_in_at
     FROM guests g
     LEFT JOIN gatepasses gp ON gp.guest_id = g.id
     WHERE g.event_id = $1 ORDER BY g.created_at ASC`,
    [eventId]
  );
  return rows;
}

async function findByEventAndPasscode(eventId, passcode) {
  const { rows } = await pool.query(
    'SELECT * FROM guests WHERE event_id = $1 AND passcode = $2',
    [eventId, passcode]
  );
  return rows[0];
}

// Accept is final and can be reached from 'pending' or 'declined' — a
// guest who declined can still change their mind. Decline is only ever
// reachable from 'pending' — once accepted, nothing can move it again.
async function recordRsvp(id, status) {
  const allowedFrom = status === 'accepted' ? ['pending', 'declined'] : ['pending'];
  const { rows } = await pool.query(
    `UPDATE guests SET rsvp_status = $1, responded_at = now()
     WHERE id = $2 AND rsvp_status = ANY($3::text[]) RETURNING *`,
    [status, id, allowedFrom]
  );
  return rows[0];
}

module.exports = {
  bulkCreate,
  findByEvent,
  findByEventAndPasscode,
  recordRsvp,
};
