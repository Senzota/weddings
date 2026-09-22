const bcrypt = require('bcrypt');
const clientModel = require('../models/client.model');
const eventModel = require('../models/event.model');
const inquiryModel = require('../models/inquiry.model');
const { EVENT_TYPES } = require('../config/eventTypes');
const { AVAILABLE_THEMES, themesForEventType } = require('../config/themes');
const { formatEventDate } = require('../utils/formatDate');

// Matches db/seed-admin.js's SALT_ROUNDS — same cost factor as this
// project's existing admin password hashing, not a separately-invented
// value.
const SALT_ROUNDS = 12;

// input_20 Phase 10C.1: the same slug->label lookups admin.controller.js
// already does inline for its own inquiry/event displays, duplicated here
// (not imported — neither is exported from that file) so the dashboard
// never shows a raw 'botanical-bloom'/'wedding' slug to a client.
function eventTypeLabel(slug) {
  const match = EVENT_TYPES.find((t) => t.slug === slug);
  return match ? match.label : slug;
}
function themeLabel(slug) {
  const match = AVAILABLE_THEMES.find((t) => t.slug === slug);
  return match ? match.label : slug;
}

// A client-friendly title built only from fields this dashboard is already
// allowed to show (couple_names, event_type) — never an internal id. Every
// event.couple_names value already exists for a reason unrelated to this
// phase (an admin-typed name, or the booking inquiry's own full_name
// carried over at approval — see inquiry.model.js's approve()), so this
// only decides how to *present* that existing value per event type, per
// this phase's own naming examples; it never invents new identity data.
function eventDisplayTitle(event) {
  const name = (event.couple_names || '').trim();
  if (!name) return `${eventTypeLabel(event.event_type)} Celebration`;
  if (event.event_type === 'birthday') return `${name}'s Birthday`;
  return name;
}

// input_20 Phase 11A: the same "active means at least one theme is
// registered for it" derivation public.controller.js's own activeEventTypes()
// already uses for the (now-legacy) public inquiry form — duplicated here
// for the same reason that file's own comment gives: neither
// admin.controller.js nor public.controller.js exports this, and this
// phase's scope doesn't touch either of those files.
function activeEventTypes() {
  return EVENT_TYPES.filter((t) => themesForEventType(t.slug).length > 0);
}

function showRegister(req, res) {
  if (req.session && req.session.clientId) return res.redirect('/client/dashboard');
  res.render('client/register', { error: null, values: {} });
}

async function register(req, res) {
  if (req.session && req.session.clientId) return res.redirect('/client/dashboard');

  const { fullName, email, phone, password, confirmPassword } = req.body;
  const values = { fullName, email, phone };

  if (!fullName || !email) {
    return res.render('client/register', { error: 'Full name and email are required.', values });
  }
  // A deliberately simple check — enough to catch an obvious typo before
  // it reaches the database, not a full RFC 5322 validator.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.render('client/register', { error: 'Please enter a valid email address.', values });
  }
  if (!password || password.length < 8) {
    return res.render('client/register', { error: 'Password must be at least 8 characters.', values });
  }
  if (password !== confirmPassword) {
    return res.render('client/register', { error: 'Password confirmation must match.', values });
  }

  const existing = await clientModel.findByEmail(email);
  if (existing) {
    // Deliberately generic — never distinguishes "email exists" from any
    // other detail about that account, and never surfaces the raw
    // Postgres unique-constraint error a raced duplicate insert would
    // otherwise throw.
    return res.render('client/register', {
      error: 'An account with that email already exists. Please sign in.',
      values,
    });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const client = await clientModel.create({ fullName, email, phone, passwordHash });

  // input_20 Phase 10A: session regeneration before setting the new
  // identity — session-fixation protection this app's existing admin
  // login doesn't have (see final report). A fresh session ID is issued
  // first, then clientId is set on that new session, so a session ID
  // known before authentication can't be reused after it.
  req.session.regenerate((err) => {
    if (err) return res.status(500).send('Something went wrong.');
    req.session.clientId = client.id;
    res.redirect('/client/dashboard');
  });
}

function showLogin(req, res) {
  if (req.session && req.session.clientId) return res.redirect('/client/dashboard');
  res.render('client/login', { error: null, values: {} });
}

async function login(req, res) {
  if (req.session && req.session.clientId) return res.redirect('/client/dashboard');

  const { email, password } = req.body;
  const values = { email };

  const client = await clientModel.findByEmail(email);
  const valid = client && (await bcrypt.compare(password || '', client.password_hash));
  if (!valid) {
    // Same message whether the email is unknown or the password is
    // wrong — never reveals which one it was.
    return res.render('client/login', { error: 'Invalid email or password.', values });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).send('Something went wrong.');
    req.session.clientId = client.id;
    res.redirect('/client/dashboard');
  });
}

function logout(req, res) {
  // input_20 Phase 10A: NOT req.session.destroy() — that would also drop
  // req.session.adminId/verifiedGuests if either happened to be present
  // in the same browser session. Only the two account/access-related keys
  // this phase owns are cleared; clientEventId is cleared too because
  // staying "inside" an event portal after signing out of the account
  // that reached it is confusing (a token-only session never has
  // clientId set to begin with, so this line has no effect on that path).
  delete req.session.clientId;
  delete req.session.clientEventId;
  req.session.save((err) => {
    if (err) return res.status(500).send('Something went wrong.');
    res.redirect('/client/login');
  });
}

async function showDashboard(req, res) {
  const client = await clientModel.findById(req.session.clientId);
  if (!client) {
    // Session references an account that no longer exists — clear the
    // stale key rather than render with nothing to show.
    delete req.session.clientId;
    return req.session.save(() => res.redirect('/client/login'));
  }

  // input_20 Phase 10C.1: ownership is looked up only from the client's own
  // session identity, never from anything request-supplied. hasPendingInquiry
  // is computed independently of whether events exist (not short-circuited
  // the way Phase 10C's single-event version did) — an owned event and a
  // separate still-pending inquiry can both be true at once, and the
  // dashboard shows a secondary notice for the latter without it displacing
  // My Events. Each event is reduced to safe display-only fields before
  // ever reaching the view: no client_id, no raw event id outside the one
  // place (a hidden form field, rendered by the view, never as visible
  // text) that ownership-scoped selection requires.
  const events = await eventModel.findAllByClientId(req.session.clientId);
  const hasPendingInquiry = await inquiryModel.hasPendingForClient(req.session.clientId);

  const myEvents = events.map((event) => ({
    id: event.id,
    typeLabel: eventTypeLabel(event.event_type),
    title: eventDisplayTitle(event),
    dateLabel: event.wedding_date ? formatEventDate(event.wedding_date) : 'To be confirmed',
    themeLabel: themeLabel(event.theme),
    statusLabel: event.status === 'live' ? 'Live' : 'Draft',
  }));

  res.render('client/dashboard', {
    client,
    myEvents,
    hasPendingInquiry,
  });
}

// input_20 Phase 10C.1: the account-owned-event handoff into the existing
// Phase 8 portal, now scoped by a client-submitted eventId since an
// account can own more than one event. The submitted value is only ever a
// selection hint — findByIdAndClientId is the sole authority, matching
// both id AND client_id in one query, so there is no window where an id
// is treated as valid before ownership is confirmed. A missing, malformed,
// nonexistent, or someone-else's-event id all collapse to the exact same
// safe no-op: redirect to the dashboard without ever touching
// clientEventId, revealing nothing about whether that id exists at all.
async function selectEvent(req, res) {
  const event = await eventModel.findByIdAndClientId(req.body.eventId, req.session.clientId);

  if (!event) {
    return res.redirect('/client/dashboard');
  }

  req.session.clientEventId = event.id;

  return req.session.save((err) => {
    if (err) return res.status(500).send('Something went wrong.');
    return res.redirect('/client');
  });
}

// input_20 Phase 11A: booking now lives inside the client account, not the
// public homepage. Same "session references an account that no longer
// exists" handling as showDashboard — clear only the client-account/access
// keys and redirect to login, never touch adminId/verifiedGuests.
async function showBookEventForm(req, res) {
  const client = await clientModel.findById(req.session.clientId);
  if (!client) {
    delete req.session.clientId;
    delete req.session.clientEventId;
    return req.session.save(() => res.redirect('/client/login'));
  }
  res.render('client/book-event', {
    client,
    eventTypes: activeEventTypes(),
    themes: AVAILABLE_THEMES,
    error: null,
    values: {},
  });
}

// input_20 Phase 11A: the client-account equivalent of the (now-legacy)
// public.controller.js#createInquiry — same active-type/theme-pairing
// validation rules, called directly against inquiryModel.create() rather
// than through an HTTP round-trip to POST /inquiries. fullName/phone/email
// come only from the server-side client record just looked up here, never
// from req.body, so a forged fullName/phone/email/clientId/status/eventId/
// token field in the submitted form has no path to reach the inserted row.
async function submitBookEvent(req, res) {
  const client = await clientModel.findById(req.session.clientId);
  if (!client) {
    delete req.session.clientId;
    delete req.session.clientEventId;
    return req.session.save(() => res.redirect('/client/login'));
  }

  const { eventType, preferredTheme, note } = req.body;
  const values = { eventType, preferredTheme, note };
  const rerender = (error) => res.render('client/book-event', {
    client,
    eventTypes: activeEventTypes(),
    themes: AVAILABLE_THEMES,
    error,
    values,
  });

  if (!eventType) {
    return rerender('Please select an event type.');
  }
  if (!activeEventTypes().some((t) => t.slug === eventType)) {
    return rerender('That event type is not available yet.');
  }
  if (preferredTheme && !themesForEventType(eventType).some((t) => t.slug === preferredTheme)) {
    return rerender('That theme is not available for the selected event type.');
  }

  await inquiryModel.create({
    fullName: client.full_name,
    phone: client.phone,
    email: client.email,
    eventType,
    preferredTheme,
    note,
    clientId: req.session.clientId,
  });
  res.redirect('/client/dashboard');
}

module.exports = {
  showRegister, register, showLogin, login, logout, showDashboard, selectEvent,
  showBookEventForm, submitBookEvent,
};
