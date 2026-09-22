// Single source of truth for the event-type selector — shared by the
// "register new event" form and the edit form, same pattern as
// config/themes.js and config/accessModes.js.
//
// input_20 Phase 1: widened from 2 to 9 types. `titleLabel` drives the
// admin form's "Couple names"/"Celebrant"/etc. label swap — previously a
// hardcoded birthday-vs-everything-else ternary in the view's own script,
// now read from each option's data-title-label attribute instead, so it
// scales to every type without another script change.
//
// Not every type here is actually offered anywhere yet. A type only
// appears in a selector once at least one theme is registered for it
// (config/themes.js) — see admin.controller.js's activeEventTypes().
// Today that's just 'wedding' and 'birthday'; the other 7 exist in this
// registry (and in the database's CHECK constraint) so the taxonomy and
// schema are ready for them, without silently offering a type nothing can
// actually theme yet.
// Bug-fix pass: dateLabel is the same kind of presentation-only, per-type
// swap titleLabel already provides for the shared edit-event.ejs page —
// wedding_date is one shared DATE column reused by every type (by design,
// see db/schema.sql), so this never changes the underlying field, only
// which label reads next to it. 'Wedding date' only for the type that
// literal wording actually describes; every other type reads the neutral
// 'Event date'.
const EVENT_TYPES = [
  { slug: 'wedding', label: 'Wedding', titleLabel: 'Couple names', dateLabel: 'Wedding date' },
  { slug: 'birthday', label: 'Birthday', titleLabel: 'Celebrant', dateLabel: 'Event date' },
  { slug: 'bridal-shower', label: 'Bridal Shower', titleLabel: 'Bride-to-be', dateLabel: 'Event date' },
  { slug: 'baby-shower', label: 'Baby Shower', titleLabel: 'Parent(s)-to-be', dateLabel: 'Event date' },
  { slug: 'engagement', label: 'Engagement', titleLabel: 'Couple names', dateLabel: 'Event date' },
  { slug: 'anniversary', label: 'Anniversary', titleLabel: 'Couple names', dateLabel: 'Event date' },
  { slug: 'graduation', label: 'Graduation', titleLabel: 'Graduate', dateLabel: 'Event date' },
  { slug: 'corporate', label: 'Corporate Event', titleLabel: 'Company / Contact name', dateLabel: 'Event date' },
  { slug: 'other', label: 'Other', titleLabel: 'Event host / title', dateLabel: 'Event date' },
];

const DEFAULT_EVENT_TYPE = 'wedding';

module.exports = { EVENT_TYPES, DEFAULT_EVENT_TYPE };
