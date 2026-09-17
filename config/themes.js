// Single source of truth for available themes — the "register new
// event" dropdown and the per-event settings dropdown both read from
// this, so adding a theme later means adding one entry here, not
// changing either form.
//
// input_15: themes are scoped by eventType — a wedding event only ever
// offers wedding themes, a birthday event only ever offers birthday
// themes. Each theme is self-contained (input_7/13), so this is just a
// filter over which ones get offered, not a conditional woven through
// every template.
const AVAILABLE_THEMES = [
  { slug: 'botanical-bloom', label: 'Botanical Bloom', eventType: 'wedding' },
  { slug: 'lavender-romance', label: 'Lavender Romance', eventType: 'wedding' },
  { slug: 'lady-gianna', label: 'Lady Gianna', eventType: 'birthday' },
];

const DEFAULT_THEME = 'botanical-bloom';

const DEFAULT_THEME_BY_EVENT_TYPE = {
  wedding: 'botanical-bloom',
  birthday: 'lady-gianna',
};

function themesForEventType(eventType) {
  return AVAILABLE_THEMES.filter((t) => t.eventType === eventType);
}

module.exports = { AVAILABLE_THEMES, DEFAULT_THEME, DEFAULT_THEME_BY_EVENT_TYPE, themesForEventType };
