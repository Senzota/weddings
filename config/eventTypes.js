// Single source of truth for the event-type selector — shared by the
// "register new event" form and the edit form, same pattern as
// config/themes.js and config/accessModes.js.
const EVENT_TYPES = [
  { slug: 'wedding', label: 'Wedding' },
  { slug: 'birthday', label: 'Birthday' },
];

const DEFAULT_EVENT_TYPE = 'wedding';

module.exports = { EVENT_TYPES, DEFAULT_EVENT_TYPE };
