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
  couple), opens the invite link, enters the passcode, sees their
  personalized invitation, and RSVPs (accept/decline, one time).
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
| passcode | unique per invite link |
| email | captured right before the card reveal, any email accepted |
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

Design rule carried over from the 102 postmortem: **RSVP status is written to
the DB unconditionally, before any email is sent.** Gatepass email delivery
is a separate, retryable step — a guest's response must never be lost because
an email failed to send.

## 5. Route map

**Guest**
- `GET /invite/:passcode` — enter passcode, view invitation
- `POST /invite/:passcode/email` — capture email, trigger animated card reveal
- `POST /invite/:passcode/rsvp` — accept/decline, once

**Admin**
- `POST /admin/login`
- `GET /admin/events` — list of all weddings this admin manages
- `GET /admin/events/new`, `POST /admin/events` — "Add Wedding"
- `GET /admin/events/:id` — dashboard for that wedding: guest list (bulk
  paste of names → passcodes auto-generated), live RSVP stats, card upload,
  wording/theme, Draft/Live toggle

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
│   └── gatepass.model.js
│
├── middleware/
│   └── auth.middleware.js         (admin session check)
│
├── utils/
│   ├── qrGenerator.js
│   ├── mailer.js
│   └── passcode.js
│
├── db/
│   └── schema.sql                 (events, guests, gatepasses, admin)
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

Planning checkpoint reached (2026-09-15). Tech stack, schema, route map, and
folder structure are all confirmed. Styling/visual design is intentionally
deferred — this spec covers structure and function only. Next: Claude Code
scaffolds this structure and starts implementing.
