const { Pool, types } = require('pg');

// DATE columns hold a plain calendar date (wedding_date), not a point in
// time. Without this, node-postgres parses them into a JS Date at local
// midnight, and any .toISOString() call on it shifts the date by a day
// whenever the server's local timezone is UTC-negative or UTC-positive —
// a bug that only shows up depending on where the process happens to run.
// Keeping it as the raw 'YYYY-MM-DD' string sidesteps timezone math entirely.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
