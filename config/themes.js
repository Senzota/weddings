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
// input_20 Phase 3: swatchColors/tagline are optional display metadata for a
// future public homepage's theme gallery — manually picked from each
// theme's own public/themes/<slug>/theme.css custom properties, not derived
// by any parser or build step. Purely additive: every existing consumer of
// AVAILABLE_THEMES (slug/label/eventType lookups, iteration) already ignores
// unknown object keys, so nothing here changes existing behavior.
const AVAILABLE_THEMES = [
  {
    slug: 'botanical-bloom', label: 'Botanical Bloom', eventType: 'wedding',
    swatchColors: ['#f6f2e7', '#9f5b4c', '#7f8f5f', '#3a3128'],
    tagline: 'Earthy, botanical elegance for garden-inspired weddings.',
  },
  {
    slug: 'lavender-romance', label: 'Lavender Romance', eventType: 'wedding',
    swatchColors: ['#f7efe3', '#cbb8d0', '#755062', '#fffdf9'],
    tagline: 'Soft lavender and mauve tones for a romantic, refined wedding.',
  },
  {
    slug: 'lady-gianna', label: 'Lady Gianna', eventType: 'birthday',
    swatchColors: ['#f9ece6', '#d98a96', '#c6a15b', '#a3b48c'],
    tagline: 'Blush, gold, and sage for a joyful birthday celebration.',
  },
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
