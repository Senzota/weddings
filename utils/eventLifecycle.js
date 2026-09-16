const pool = require('../config/db');
const { archiveAndDelete } = require('../models/archive.model');

// Single-process, in-app sweep rather than a separate Render Cron Job —
// keeps this a one-service deployment. Runs once at boot (so a cold-start
// restart doesn't leave a wedding lingering for a full day) and then daily.
// Render's free tier can spin the whole app down when idle, so this can
// slip by a few days if nothing else wakes it — acceptable here since nothing
// depends on same-day deletion 30 days after a wedding.
async function sweepExpiredEvents() {
  const { rows } = await pool.query(
    `SELECT id, couple_names FROM events WHERE wedding_date < (CURRENT_DATE - INTERVAL '30 days')`
  );
  for (const { id, couple_names: coupleNames } of rows) {
    try {
      await archiveAndDelete(id);
      console.log(`Auto-archived and deleted event ${id} (${coupleNames}) — wedding_date is 30+ days past.`);
    } catch (err) {
      console.error(`Failed to auto-archive event ${id} (${coupleNames}):`, err);
    }
  }
}

function startEventLifecycleSweep() {
  sweepExpiredEvents().catch((err) => console.error('Initial event sweep failed:', err));
  setInterval(() => {
    sweepExpiredEvents().catch((err) => console.error('Scheduled event sweep failed:', err));
  }, 24 * 60 * 60 * 1000);
}

module.exports = { sweepExpiredEvents, startEventLifecycleSweep };
