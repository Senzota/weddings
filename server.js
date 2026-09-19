// Render's network has no outbound IPv6 route. Node 18+ resolves DNS
// IPv6-first by default, so any outbound connection (SMTP to Gmail
// included) tries the IPv6 address first, fails with ENETUNREACH, and
// only then falls back to IPv4 — when it falls back at all. Forcing IPv4
// first here, before anything else touches the network, avoids that.
require('dns').setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./config/db');

const guestRoutes = require('./routes/guest.routes');
const adminRoutes = require('./routes/admin.routes');
const scanRoutes = require('./routes/scan.routes');
const publicRoutes = require('./routes/public.routes');
const { startEventLifecycleSweep } = require('./utils/eventLifecycle');
const { formatEventDate } = require('./utils/formatDate');
const { getDownloadUrl } = require('./utils/cloudinary');
const { assetExists } = require('./utils/assetExists');

const app = express();
app.locals.formatEventDate = formatEventDate;
app.locals.getDownloadUrl = getDownloadUrl;
app.locals.assetExists = assetExists;

// Render terminates TLS at its edge and forwards to this app over plain
// HTTP, so req.protocol would otherwise always read 'http' — which leaked
// into the admin dashboard's shareable invite link as an http:// URL.
// Trusting the proxy makes req.protocol read the real X-Forwarded-Proto.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Served straight from node_modules so it always matches the installed
// jsqr version — no separate vendored copy to fall out of sync.
app.get('/vendor/jsqr.js', (req, res) => res.sendFile(require.resolve('jsqr/dist/jsQR.js')));

app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
}));

// input_20 Phase 5: replaces the previous unconditional redirect to
// /admin/login with the public homepage + booking-inquiry routes. Mounted
// at '/' (GET / and POST /inquiries only — routes/public.routes.js), before
// the catch-all 404 below, same as every other router.
app.use('/', publicRoutes);
app.use('/invite', guestRoutes);
app.use('/admin', adminRoutes);
app.use('/scan', scanRoutes);

app.use((req, res) => res.status(404).send('Not found.'));

// Centralized error logging — real errors, real stack traces, always in the
// logs. No silent failures like the Apps Script backend this replaces.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

// Last-resort safety net. Every route is wrapped in asyncHandler, so this
// should rarely fire — but an uncaught error here previously crashed the
// whole process silently (no log line, just a dead server). Logging first
// means a crash is at least diagnosable instead of a mystery 502.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Weddings 103 listening on port ${PORT}`);
  startEventLifecycleSweep();
});
