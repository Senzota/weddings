const { EVENT_TYPES } = require('../config/eventTypes');
const { AVAILABLE_THEMES, themesForEventType } = require('../config/themes');
const inquiryModel = require('../models/inquiry.model');

// input_20 Phase 5: the same one-line "active means at least one theme is
// registered for it" derivation as admin.controller.js's activeEventTypes().
// Duplicated here rather than imported — that function isn't exported, and
// this phase's scope deliberately makes no change to admin.controller.js.
function activeEventTypes() {
  return EVENT_TYPES.filter((t) => themesForEventType(t.slug).length > 0);
}

// Also used internally by createInquiry to re-render the homepage in place
// on a validation failure, carrying the visitor's own submitted values back
// (safe — EJS's <%= %> escapes them) rather than losing the form on error.
function showHome(req, res, options) {
  const opts = options || {};
  res.render('public/home', {
    eventTypes: activeEventTypes(),
    themes: AVAILABLE_THEMES,
    submitted: req.query.submitted === '1',
    error: opts.error || null,
    values: opts.values || {},
  });
}

async function createInquiry(req, res) {
  const { fullName, phone, email, eventType, preferredTheme, note } = req.body;
  const values = { fullName, phone, email, eventType, preferredTheme, note };

  if (!fullName || !phone || !email || !eventType) {
    return showHome(req, res, { error: 'Name, phone, email, and event type are required.', values });
  }

  // The Book Now form's client-side script only ever offers an active
  // event type and a theme that belongs to it — but that script is not a
  // trust boundary, so both pairings are re-checked here independently of
  // whatever the request actually contains.
  if (!activeEventTypes().some((t) => t.slug === eventType)) {
    return showHome(req, res, { error: 'That event type is not available yet.', values });
  }

  if (preferredTheme && !themesForEventType(eventType).some((t) => t.slug === preferredTheme)) {
    return showHome(req, res, { error: 'That theme is not available for the selected event type.', values });
  }

  // input_20 Phase 10B: server-derived only — req.session.clientId is set
  // solely by the existing Phase 10A login/register flow, never by this
  // request's own body/query, so a forged clientId field in the submitted
  // form is simply ignored (inquiryModel.create() never reads req.body).
  const clientId = req.session && req.session.clientId ? req.session.clientId : null;

  await inquiryModel.create({ fullName, phone, email, eventType, preferredTheme, note, clientId });
  res.redirect('/?submitted=1');
}

module.exports = { showHome, createInquiry };
