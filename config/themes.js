// Single source of truth for available themes — the "register new
// wedding" dropdown and the per-event settings dropdown both read from
// this, so adding a theme later means adding one entry here, not
// changing either form.
const AVAILABLE_THEMES = [
  { slug: 'botanical-bloom', label: 'Botanical Bloom' },
  { slug: 'lavender-romance', label: 'Lavender Romance' },
];

const DEFAULT_THEME = 'botanical-bloom';

module.exports = { AVAILABLE_THEMES, DEFAULT_THEME };
