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

async function findByPasscodeOnly(passcode) {
  const { rows } = await pool.query(
    'SELECT * FROM guests WHERE passcode = $1', [passcode]
  );
  return rows[0];
}

async function setEmail(id, email) {
  const { rows } = await pool.query(
    'UPDATE guests SET email = $1 WHERE id = $2 RETURNING *',
    [email, id]
  );
  return rows[0];
}

async function recordRsvp(id, status) {
  const { rows } = await pool.query(
    `UPDATE guests SET rsvp_status = $1, responded_at = now()
     WHERE id = $2 AND rsvp_status = 'pending' RETURNING *`,
    [status, id]
  );
  return rows[0];
}

module.exports = {
  bulkCreate,
  findByEvent,
  findByPasscodeOnly,
  setEmail,
  recordRsvp,
};
