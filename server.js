require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const pool = require('./config/db');

const guestRoutes = require('./routes/guest.routes');
const adminRoutes = require('./routes/admin.routes');
const scanRoutes = require('./routes/scan.routes');

const app = express();

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

app.get('/', (req, res) => res.redirect('/admin/login'));
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Weddings 103 listening on port ${PORT}`));
