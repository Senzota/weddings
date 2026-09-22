function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.redirect('/admin/login');
}

// input_20 Phase 8: checks only req.session.clientEventId — never adminId,
// never sets/clears/reads admin session state. A client route reached
// without a valid session has no login page to redirect to (tokens are
// the only entry point), so this reuses the exact same neutral response
// GET /client/:token gives an invalid/unknown token — indistinguishable
// from "no such link" either way, revealing nothing about whether client
// routes even exist.
function requireClient(req, res, next) {
  if (req.session && req.session.clientEventId) return next();
  return res.status(404).send('Link not found.');
}

// input_20 Phase 10A: checks only req.session.clientId — the account
// identity, a separate key from clientEventId (Phase 8's per-event portal
// session, still set only by a token or, later, an owned-event selection)
// and from adminId. Unlike requireClient, this DOES have a real login page
// to redirect to, since account login is a normal signed-in flow, not a
// secret-link bootstrap.
function requireClientAccount(req, res, next) {
  if (req.session && req.session.clientId) return next();
  return res.redirect('/client/login');
}

module.exports = { requireAdmin, requireClient, requireClientAccount };
