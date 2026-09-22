const pool = require('../config/db');

// input_20 Phase 10A: normalized once, here, so every caller (register,
// login) gets the same case-insensitive-in-practice behavior without
// needing a functional index — trim first so " Foo@Bar.com " and
// "foo@bar.com" collide too, not just casing.
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function create({ fullName, email, phone, passwordHash }) {
  const { rows } = await pool.query(
    `INSERT INTO clients (full_name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [fullName, normalizeEmail(email), phone || null, passwordHash]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM clients WHERE email = $1',
    [normalizeEmail(email)]
  );
  return rows[0];
}

// Same numeric guard as event.model.js's/inquiry.model.js's findById — id
// is a serial integer column, so anything non-numeric would otherwise
// reach Postgres as "invalid input syntax for type integer" instead of a
// normal not-found.
async function findById(id) {
  if (!/^\d+$/.test(String(id))) return undefined;
  const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
  return rows[0];
}

// input_20 Phase 11B: the read-only admin client directory's one list
// query. LEFT JOINing both events and booking_inquiries in a single query
// would multiply each event row by every inquiry row (and vice versa) for
// the same client, inflating both COUNT(DISTINCT ...)s — using DISTINCT on
// each joined table's own id, rather than a bare COUNT(*), is what keeps
// the two counts correct despite the cross-join fan-out. No password_hash,
// no token/session data — only the columns admin/clients-list.ejs needs.
async function findAllWithCounts() {
  const { rows } = await pool.query(`
    SELECT
      c.id,
      c.full_name,
      c.email,
      c.phone,
      c.created_at,
      COUNT(DISTINCT e.id)::int AS event_count,
      COUNT(DISTINCT CASE WHEN i.status = 'new' THEN i.id END)::int AS pending_inquiry_count
    FROM clients c
    LEFT JOIN events e
      ON e.client_id = c.id
    LEFT JOIN booking_inquiries i
      ON i.client_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  return rows;
}

module.exports = { create, findByEmail, findById, normalizeEmail, findAllWithCounts };
