const bcrypt = require('bcrypt');
const clientModel = require('../models/client.model');
const eventModel = require('../models/event.model');
const inquiryModel = require('../models/inquiry.model');

// Matches db/seed-admin.js's SALT_ROUNDS — same cost factor as this
// project's existing admin password hashing, not a separately-invented
// value.
const SALT_ROUNDS = 12;

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

  // input_20 Phase 10C: ownership is looked up only from the client's own
  // session identity, never from anything request-supplied. The view gets
  // booleans only — no event/inquiry object, id, or status ever reaches
  // `client/dashboard`, by construction of what's passed to res.render
  // below.
  const event = await eventModel.findByClientId(req.session.clientId);
  const hasPendingInquiry = event ? false : await inquiryModel.hasPendingForClient(req.session.clientId);

  res.render('client/dashboard', {
    client,
    hasOwnedEvent: Boolean(event),
    hasPendingInquiry,
  });
}

// input_20 Phase 10C: the account-owned-event handoff into the existing
// Phase 8 portal. The event is found solely via req.session.clientId —
// req.params/req.query/req.body are never read here, so a forged eventId/
// id/clientId field in the request has no path to influence which event
// (if any) clientEventId gets set to. No owned event means a safe no-op
// redirect: clientEventId is left exactly as it was (never cleared here),
// since a failed account-selection attempt is not a reason to evict a
// session that already reached the portal through a token.
async function selectEvent(req, res) {
  const event = await eventModel.findByClientId(req.session.clientId);

  if (!event) {
    return res.redirect('/client/dashboard');
  }

  req.session.clientEventId = event.id;

  return req.session.save((err) => {
    if (err) return res.status(500).send('Something went wrong.');
    return res.redirect('/client');
  });
}

module.exports = { showRegister, register, showLogin, login, logout, showDashboard, selectEvent };
