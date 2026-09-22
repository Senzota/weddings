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

module.exports = { create, findByEmail, findById, normalizeEmail };
