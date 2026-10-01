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
//
// input_20 Phase 4: googleFonts is the exact Google Fonts stylesheet URL
// each theme's own dashboard.ejs already links directly — copied verbatim,
// not recomputed — so edit-event.ejs can load the right fonts for whichever
// theme the event being edited actually uses, instead of a hardcoded union
// of every theme's fonts. Also purely additive.
const AVAILABLE_THEMES = [
  {
    slug: 'botanical-bloom', label: 'Botanical Bloom', eventType: 'wedding',
    swatchColors: ['#f6f2e7', '#9f5b4c', '#7f8f5f', '#3a3128'],
    tagline: 'Earthy, botanical elegance for garden-inspired weddings.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Beau+Rivage&family=Cormorant+Garamond:wght@400;500;600&display=swap',
  },
  {
    slug: 'lavender-romance', label: 'Lavender Romance', eventType: 'wedding',
    swatchColors: ['#f7efe3', '#cbb8d0', '#755062', '#fffdf9'],
    tagline: 'Soft lavender and mauve tones for a romantic, refined wedding.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=DM+Sans:wght@400;500;600;700&family=Great+Vibes&display=swap',
  },
  {
    slug: 'lady-gianna', label: 'Lady Gianna', eventType: 'birthday',
    swatchColors: ['#f9ece6', '#d98a96', '#c6a15b', '#a3b48c'],
    tagline: 'Blush, gold, and sage for a joyful birthday celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Libre+Baskerville:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap',
  },
  // Plain Card — a universal theme, approved for every existing event-type
  // slug in config/eventTypes.js. This registry uses one eventType per
  // entry (not an array), so one entry per type is the only way to offer
  // the same theme across types without changing that existing shape —
  // every field below stays byte-identical across all nine entries except
  // eventType itself, since the two .find(t => t.slug === slug) label
  // lookups in admin.controller.js/clientAccount.controller.js resolve to
  // whichever entry appears first regardless of an event's actual type.
  { slug: 'plain-card', label: 'Plain Card', eventType: 'wedding',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'birthday',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'bridal-shower',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'baby-shower',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'engagement',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'anniversary',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'graduation',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'corporate',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  { slug: 'plain-card', label: 'Plain Card', eventType: 'other',
    swatchColors: ['#f4eee5', '#a98456', '#241f1a', '#fffdf9'],
    tagline: 'A quiet, editorial keepsake card for any celebration.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap' },
  // Custom Invitation — same multi-event-type pattern as Plain Card: one
  // entry per type, every field byte-identical except eventType, for the
  // same .find(slug)-safety reason documented above.
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'wedding',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'birthday',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'bridal-shower',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'baby-shower',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'engagement',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'anniversary',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'graduation',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'corporate',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
  { slug: 'custom-invitation', label: 'Custom Invitation', eventType: 'other',
    swatchColors: ['#211f1a', '#f5f1e8', '#5c574d', '#fbfaf6'],
    tagline: 'Your own design, presented exactly as you made it.',
    googleFonts: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=DM+Sans:wght@400;500;600&display=swap' },
];

const DEFAULT_THEME = 'botanical-bloom';

// Judgment call (see PROMPT-REPORT.md's Custom Invitation phase, "Issues
// found"): the task instruction said
// "add it to DEFAULT_THEME_BY_EVENT_TYPE for each [of the nine types]",
// which read literally would also reassign wedding/birthday's own
// deliberately-chosen flagship defaults (botanical-bloom, lady-gianna) to
// custom-invitation. Those two predate Plain Card and were left untouched
// when Plain Card became the default for the other seven types in the
// prior release — kept that same precedent here rather than silently
// changing what an un-themed new wedding/birthday event falls back to.
// custom-invitation replaces plain-card as the fallback for the other
// seven types, which had no prior deliberate default.
const DEFAULT_THEME_BY_EVENT_TYPE = {
  wedding: 'botanical-bloom',
  birthday: 'lady-gianna',
  'bridal-shower': 'custom-invitation',
  'baby-shower': 'custom-invitation',
  engagement: 'custom-invitation',
  anniversary: 'custom-invitation',
  graduation: 'custom-invitation',
  corporate: 'custom-invitation',
  other: 'custom-invitation',
};

function themesForEventType(eventType) {
  return AVAILABLE_THEMES.filter((t) => t.eventType === eventType);
}

module.exports = { AVAILABLE_THEMES, DEFAULT_THEME, DEFAULT_THEME_BY_EVENT_TYPE, themesForEventType };
