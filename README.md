# Weddings 103

A digital wedding invitation, RSVP, and door check-in platform. Admins create
an event, set its theme and wording, and manage a guest list; each guest gets
a passcode-gated personalized invitation, RSVPs, and, for closed events,
receives a QR gatepass for door-staff check-in. See
`WEDDINGS-103-BRIEF.md` for the full product vision.

## Stack

Node.js, Express, EJS (server-rendered views), PostgreSQL (raw `pg`, no ORM),
Cloudinary (image storage), `express-session` and `connect-pg-simple`
(session store).

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root. Required variable names:

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — session cookie signing secret
- `PORT` — optional; defaults to `3000`
- `CLOUDINARY_URL` — read automatically by the Cloudinary SDK
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` — used by the admin-seeding script
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` —
  outbound email configuration for guest QR gatepass delivery

3. Apply the schema and seed the first admin account:

```bash
npm run db:migrate
npm run db:seed-admin
```

## Running the app

```bash
npm start
npm run dev
```

`npm run dev` restarts the server when files change.

## Migrations

Schema changes live in `db/schema.sql` and are written to be safely re-run
using idempotent SQL patterns such as `CREATE TABLE IF NOT EXISTS` and guarded
`ALTER` statements.

```bash
npm run db:migrate
```

To seed the first admin account:

```bash
npm run db:seed-admin
```

The script reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. Alternatively:

```bash
node db/seed-admin.js <email> <password>
```

## Tests

No automated test suite exists yet. Verify changes manually against a locally
running server and local PostgreSQL database.

## Deployment

The app is hosted on Render and configured through its dashboard. In the
current setup, pushes to `main` trigger Render deployments.

## Repository structure

- `server.js` — app entry point, middleware, and route mounting
- `config/` — theme, event-type, access-mode registries, and database pool
- `routes/`, `controllers/`, `models/` — Express routers, handlers, and
  data-access functions
- `middleware/` — authentication and request guards
- `views/` — EJS templates for `admin/`, `guest/`, and `public/` pages
- `public/` — static CSS, client-side JavaScript, uploads, and theme assets
- `db/` — schema and database scripts
- `utils/` — focused helpers for formatting, tokens, and email
