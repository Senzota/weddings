const crypto = require('crypto');
const pool = require('../config/db');

// input_20 Phase 8: the raw token only ever exists in memory for the one
// request that receives it — hashed here with the exact same algorithm/
// encoding Phase 7 used to create it (sha256 hex), looked up by hash only.
// Never logs, stores, or returns the raw token; never returns token_hash
// itself to a caller (only event_id), so nothing here can leak a value
// that could be replayed against this table.
async function findEventIdByToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return undefined;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const { rows } = await pool.query(
    'SELECT event_id FROM client_access WHERE token_hash = $1',
    [tokenHash]
  );
  return rows[0] ? rows[0].event_id : undefined;
}

module.exports = { findEventIdByToken };
