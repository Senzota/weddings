# Weddings 103 — Architecture Spec

Written as a planning handoff for Claude Code (VS Code) to build from. This is a
clean rebuild — nothing carried over from Weddings 101 (GitHub Pages) or
Weddings 102 (Google Apps Script + Sheets). Both earlier builds are retired.

## 1. Why this rebuild

Weddings 102 was torn down because Apps Script + split hosting (GitHub Pages
for frontend, Apps Script for backend) caused silent hangs, identity quirks,
and hard-to-debug failures. Weddings 103 breaks cleanly from both:

- One app, one hosting target — no split between frontend and backend.
- A real server with real logs — no opaque platform runtime to debug blind.
- Still a single admin (not a login-per-client SaaS), no payment processing,
  no guest login. Guests only ever use a passcode link.

## 2. Tech stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Views:** server-rendered EJS templates (keeps it one app, no separate
  frontend build step)
- **Hosting:** Render — one web service + one managed Postgres addon, under
  a single account
- **UI language:** English throughout, both guest-facing and admin — regardless
  of what language is used when talking to Claude/Claude Code about the project

## 3. Users / roles

- **Guest** — receives a passcode (out of band, e.g. WhatsApp/SMS from the
  couple), opens **one shared link per wedding** (`/invite/:eventId` — not
  per guest), enters their passcode, sees their personalized invitation, and
  RSVPs (accept/decline, one time). On acceptance the gatepass QR is shown
  directly on the page — nothing is emailed. Every subsequent visit re-enters
  through the same passcode form; the page then routes on the guest's current
  state (pending / accepted-with-QR / checked-in-recently-still-shows-QR /
  checked-in-6h+-ago-no-longer-active / declined).
- **Admin (couple / event organizer)** — manages one or more weddings from a
  single admin account. Creates each wedding as its own event, uploads the
  invitation card image, sets wording/theme, manages the guest list, and
  watches RSVP stats live. **This is the most complex part of the build and
  deserves the most attention**, both functionally and (later) visually.
- **Door staff** — on the wedding day, uses a scanner page to scan each
  guest's QR gatepass and check them in.

Important: admin supports **multiple weddings** under one account (an events
list + "Add Wedding" + a dashboard per event) — it is not locked to a single
wedding. It is still not a multi-tenant SaaS with separate client logins;
that's a possible later phase, not v1.

## 4. Database schema

**events**
| field | notes |
|---|---|
| id | PK |
| couple_names | |
| wedding_date | |
| venue | |
| theme_color | |
| card_image | path/URL to uploaded invitation card |
| accept_button_text | custom wording, set per wedding |
| decline_button_text | custom wording, set per wedding |
| status | `draft` \| `live` — guests can't open links until live |

**guests**
| field | notes |
|---|---|
| id | PK |
| event_id | FK → events |
| name | |
| seat_count | from bulk-add ("Name, seat count" lines) |
| passcode | unique, looked up as `(event_id, passcode)` since the invite link is now shared per event, not per guest |
| email | **unused** — kept in the schema but no longer collected or read anywhere; the guest flow has no email step |
| rsvp_status | `pending` \| `accepted` \| `declined` |
| responded_at | |

**gatepasses**
| field | notes |
|---|---|
| id | PK |
| guest_id | FK → guests |
| qr_token | unique, one-time |
| issued_at | |
| checked_in | boolean |
| checked_in_at | |
| duplicate_attempts | counter — a second scan of the same QR is flagged, not admitted |

**admin**
| field | notes |
|---|---|
| id | PK |
| email | |
| password_hash | |

**event_archive** — anonymous summary metrics preserved when an event is
deleted (manually or by the 30-day auto-sweep); never purged by anything.
| field | notes |
|---|---|
| id | PK |
| couple_names, wedding_date, venue | copied from the deleted event |
| total_guests, total_seats | |
| accepted_count, declined_count, pending_count | |
| seats_accepted | |
| checked_in_count | |
| response_rate | `(accepted + declined) / total_guests`, null if no guests |
| attendance_rate | `checked_in_count / accepted_count`, null if none accepted |
| event_created_at, archived_at | |

Design rule carried over from the 102 postmortem: **RSVP status is written to
the DB unconditionally, before any other step that could fail.** The gatepass
QR is generated and rendered directly on the page on acceptance — there is no
email step in the guest-critical path at all (see §5.1), so there's nothing
in that path left to silently fail. `utils/mailer.js` still exists (an
IPv4-first DNS fix — `dns.setDefaultResultOrder('ipv4first')` in `server.js`
— was needed to get it working on Render at all, since Render has no
outbound IPv6 route and Gmail SMTP was failing with `ENETUNREACH`) but it is
dormant, kept only for a possible future "also email me a copy" option — it
is never called from the guest flow.

## 5. Route map

**Guest (§5.1 — one shared link per event)**
- `GET /invite/:eventId` — passcode-entry form for that wedding (404 if the
  event doesn't exist, "not available yet" if it's still Draft)
- `POST /invite/:eventId/verify` — passcode submitted; looks up
  `(event_id, passcode)` and renders whatever state that guest is
  currently in (see the state table in §3)
- `POST /invite/:eventId/rsvp` — accept/decline, once; passcode is
  resubmitted as a hidden field (there's no guest session — every action
  re-proves identity via the passcode). On acceptance, the gatepass QR is
  generated and rendered in the same response.

**Admin**
- `POST /admin/login`
- `GET /admin/events` — list of all weddings this admin manages
- `GET /admin/events/new`, `POST /admin/events` — "Add Wedding"
- `GET /admin/events/:id` — dashboard for that wedding: **shareable invite
  link** (`BASE_URL/invite/:eventId`) with a copy button, guest list (bulk
  paste of names → passcodes auto-generated, each with a "Copy Code"
  button), live RSVP stats, card upload, wording/theme, Draft/Live toggle
- `POST /admin/events/:id/delete` — archives summary metrics into
  `event_archive`, then deletes the event (guests/gatepasses cascade via
  FK). Behind a confirm dialog; irreversible. The same underlying operation
  also runs automatically once a day (`utils/eventLifecycle.js`, kicked off
  in `server.js` at boot and every 24h after) for any event whose
  `wedding_date` is more than 30 days in the past — no admin action needed.

**Door staff**
- `GET /scan` — camera scanner page
- `POST /scan/verify` — verify QR token; first scan checks in, repeat scan
  is flagged as duplicate

## 6. Folder structure

Follows the existing project convention: purpose-named top-level folders,
related multi-file content grouped into its own subfolder, loose planning
docs kept in the project root.

```
Weddings 103/
├── WEDDINGS-103-BRIEF.md
├── ARCHITECTURE.md                (this file)
├── .env                           (DATABASE_URL, email creds — gitignored)
├── .gitignore
├── package.json
├── server.js                      (entry point)
│
├── config/
│   └── db.js                      (Postgres connection)
│
├── routes/
│   ├── guest.routes.js
│   ├── admin.routes.js
│   └── scan.routes.js
│
├── controllers/
│   ├── guest.controller.js
│   ├── admin.controller.js
│   └── scan.controller.js
│
├── models/
│   ├── event.model.js
│   ├── guest.model.js
│   ├── gatepass.model.js
│   └── archive.model.js           (archive-then-delete, one transaction)
│
├── middleware/
│   └── auth.middleware.js         (admin session check)
│
├── utils/
│   ├── qrGenerator.js             (QR image buffer + on-page data URL)
│   ├── mailer.js                  (dormant — not called from the guest flow)
│   ├── passcode.js
│   ├── asyncHandler.js            (wraps every route; see §7)
│   └── eventLifecycle.js          (30-day auto-archive sweep)
│
├── db/
│   ├── schema.sql                 (events, guests, gatepasses, admin, event_archive)
│   ├── migrate.js
│   └── seed-admin.js
│
├── views/
│   ├── guest/
│   │   └── invite.ejs
│   ├── admin/
│   │   ├── login.ejs
│   │   ├── events-list.ejs
│   │   ├── event-form.ejs
│   │   └── dashboard.ejs
│   └── scan/
│       └── scanner.ejs
│
└── public/
    ├── assets/
    │   ├── css/
    │   ├── js/
    │   └── img/
    └── uploads/                   (card images — gitignored contents)
```

## 7. Status

Built, deployed, and redesigned once already (2026-09-15 to 2026-09-16).
Live on Render (`weddings-wbm9.onrender.com`) with a Neon Postgres database.
Every route handler is wrapped in `utils/asyncHandler.js` — Express 4 does
not catch rejected promises from async handlers on its own, and an early
version of this app learned that the hard way (one bad request crashed the
whole process for every user, not just that request). `server.js` also
installs `process.on('unhandledRejection'/'uncaughtException')` logging as a
last-resort safety net, and forces IPv4-first DNS resolution
(`dns.setDefaultResultOrder('ipv4first')`) since Render has no outbound IPv6
route.

The guest flow was reworked from a per-guest unique link (with an
email-capture step and an emailed QR) to the one-shared-link-per-event,
no-email, on-page-QR design described above — see §3 and §5 for the
current behavior; treat any older description of a per-guest `/invite/:passcode`
link or an email-capture step as stale. Styling/visual design is still
intentionally deferred — this spec covers structure and function only.
