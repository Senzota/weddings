// Single source of truth for the access-mode selector on both the
// "register new event" form and the edit form.
const ACCESS_MODES = [
  { slug: 'closed', label: 'Closed — code, RSVP, QR gatepass, door check-in (default)' },
  { slug: 'recognized', label: 'Recognized — code required, personalized, RSVP tracked, no QR/check-in' },
  { slug: 'open', label: 'Open — fully public, no code, no RSVP, informational only' },
];

const DEFAULT_ACCESS_MODE = 'closed';

module.exports = { ACCESS_MODES, DEFAULT_ACCESS_MODE };
