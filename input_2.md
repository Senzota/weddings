# Input 2 — Deploy to Render

Goal: get Weddings 103 live on the internet, on the single-hosting setup
ARCHITECTURE.md commits to (one web service + one managed Postgres, both
under one Render account — no split hosting).

Some steps below need a human in a browser (GitHub, Render dashboard,
Gmail) — marked **[You]**. Steps Claude Code can do from the terminal/files
are marked **[Claude Code]**.

## 1. Get the code into GitHub

**[You + Claude Code]** Render deploys from a git repo.

- If this project isn't a git repo yet: **[Claude Code]** `git init`, confirm
  `.env`, `node_modules/`, and `public/uploads/*` (except a `.gitkeep`) are in
  `.gitignore` — real secrets and uploaded card images must never be
  committed — then commit everything else.
- **[You]** Create a new empty repository on GitHub (private is fine, this
  has no reason to be public).
- **[Claude Code]** Add it as the remote and push: `git remote add origin
  <url>`, `git push -u origin main`.

## 2. Create the Render Postgres database

**[You]** In the Render dashboard: New → PostgreSQL. Free/Starter plan is
plenty for one wedding. Once it's up, copy its **Internal Database URL**
(you'll need it in step 4).

## 3. Create the Render Web Service

**[You]** New → Web Service → connect the GitHub repo from step 1.

- Build command: `npm install`
- Start command: `npm start` (check `package.json` has a `start` script
  pointing at `server.js` — **[Claude Code]** add one if missing)
- Instance type: Free is fine to start (see the cold-start note below)

## 4. Environment variables (set in the Render Web Service's Environment tab)

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Internal Database URL from step 2 |
| `SESSION_SECRET` | a long random string — **[Claude Code]** generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, don't reuse the local dev one |
| `BASE_URL` | the Render URL, e.g. `https://weddings103.onrender.com` (get this after the first deploy, then update it) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | a Gmail **App Password** (not your normal password — see below) |
| `MAIL_FROM` | `"Weddings 103 <your-gmail-address>"` |

**Email provider note:** recommending Gmail SMTP over a new signup —
you already have a Gmail account, its send limit (~500/day) is far more than
one wedding's guest list needs, and it avoids a new service to manage. To get
an App Password: Google Account → Security → 2-Step Verification (must be
on) → App passwords → generate one for "Mail". If Gmail ever gives you
trouble (spam-folder delivery, etc.), Resend or SendGrid are the fallback —
say so and we'll switch.

## 5. Run the database migration and seed the admin — once, on Render

**[You + Claude Code]** Open a Render Shell for the web service (Render
dashboard → your service → Shell tab) and run:

```
node db/migrate.js
npm run db:seed-admin
```

Use a **real** admin email and a **new, strong** password here — set
`ADMIN_EMAIL` / `ADMIN_PASSWORD` as one-off env vars for this shell command
(or temporarily in the Environment tab), not the test credentials from local
dev.

## 6. Smoke test on the live URL

Repeat a short version of input_1.md's flow against the real Render URL:
log in as admin, create a real (or throwaway test) event, bulk-add a guest,
open the invite link, RSVP, confirm the gatepass email actually lands in a
real inbox this time (not Ethereal), and scan it at `/scan`.

## Cold starts — know this going in

On Render's Free tier, the web service spins down after ~15 minutes of no
traffic and takes 30–50 seconds to wake up on the next request. For a
wedding invite that guests open sporadically over days or weeks, this means:
occasionally the first guest to open a link in a while will see a slow load,
not a broken one. If that's not acceptable, the fix is upgrading the Render
plan (no code change needed) — flag it if this matters enough to do before
sending real invites.

## Issues found

*(Claude Code: log anything that goes wrong during deploy or the live smoke
test here, with steps to reproduce.)*
