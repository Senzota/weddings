// wedding_date comes back from the DB as a plain 'YYYY-MM-DD' string (see
// config/db.js's type parser). Appending a local-time literal here, rather
// than parsing the bare date string (which JS treats as UTC midnight),
// avoids the exact same day-shift bug that motivated that type parser.
function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

module.exports = { formatEventDate };
