// Creates (or updates the password of) the admin account.
// Usage: node db/seed-admin.js [email] [password]
// Falls back to ADMIN_EMAIL / ADMIN_PASSWORD in .env when args are omitted.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const SALT_ROUNDS = 12;

async function seedAdmin() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Missing admin email/password. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or pass them as arguments: node db/seed-admin.js <email> <password>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // ON CONFLICT keeps this safe to re-run (e.g. to rotate the password)
  // without erroring on the unique email constraint or creating a duplicate.
  const { rows } = await pool.query(
    `INSERT INTO admin (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email`,
    [email, passwordHash]
  );

  console.log(`Admin ready: ${rows[0].email} (id ${rows[0].id})`);
  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('Seeding admin failed:', err);
  process.exit(1);
});
