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
const EVENT_TYPES = [
  { slug: 'wedding', label: 'Wedding', titleLabel: 'Couple names' },
  { slug: 'birthday', label: 'Birthday', titleLabel: 'Celebrant' },
  { slug: 'bridal-shower', label: 'Bridal Shower', titleLabel: 'Bride-to-be' },
  { slug: 'baby-shower', label: 'Baby Shower', titleLabel: 'Parent(s)-to-be' },
  { slug: 'engagement', label: 'Engagement', titleLabel: 'Couple names' },
  { slug: 'anniversary', label: 'Anniversary', titleLabel: 'Couple names' },
  { slug: 'graduation', label: 'Graduation', titleLabel: 'Graduate' },
  { slug: 'corporate', label: 'Corporate Event', titleLabel: 'Company / Contact name' },
  { slug: 'other', label: 'Other', titleLabel: 'Event host / title' },
];

const DEFAULT_EVENT_TYPE = 'wedding';

module.exports = { EVENT_TYPES, DEFAULT_EVENT_TYPE };
