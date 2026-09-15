# Weddings 103 — Project Brief

Written after building (and learning from) **Weddings 101**. This is the starting brief for the rebuild — the *what* and *why*, not the *how*. Tech stack, design language, and hosting provider are all being chosen fresh for this project; nothing is carried over from 101 except the lessons below.

## 1. Vision

A digital wedding invitation, RSVP, and door check-in platform for the couple (or their event organizer). It replaces paper invites with a personalized, passcode-gated web invite that reveals the couple's card, collects an RSVP, automatically emails a QR gatepass on acceptance, and gives the couple a live dashboard of who's coming, who declined, and who's actually shown up at the door. This is now intended to be a real, officially-hosted product — not a prototype.

## 2. Users

- **Guest** — receives a passcode (out of band, e.g. WhatsApp/SMS from the couple), opens the invite link, enters the passcode, sees their personalized invitation, and RSVPs.
- **Admin / Couple** — creates the wedding event, uploads the invitation card image, sets wording and theme, manages the guest list, and watches RSVP stats come in.
- **Door staff** — on the wedding day, uses a phone camera to scan each guest's QR gatepass and check them in.

## 3. Core features to carry forward

These worked well in 101 and should be rebuilt, not reinvented:

- **Passcode-gated invite** — each guest gets a unique passcode; the link alone isn't enough to see the invitation. Keeps it feeling VIP and stops the link being casually forwarded to uninvited people.
- **Email capture before reveal** — guest provides their email right before seeing the card, so the gatepass has somewhere to go.
- **Animated reveal** — card image, couple names, date, venue, and custom accept/decline button wording, revealed with a bit of polish (not a flat form dump).
- **One-time RSVP** — accept or decline, once. Returning with the same passcode afterward shows a friendly "you already responded" state, not the form again.
- **Automatic gatepass email** — on acceptance, a single-use QR code is generated and emailed immediately. If the email fails to send, the RSVP is still recorded (never lose a guest's response over a delivery hiccup).
- **Admin dashboard**:
  - Create an event: couple names, date, venue, theme color, accept/decline wording, card image upload.
  - Draft / Live toggle — nothing is guest-visible until the couple is ready.
  - Bulk-add guests: paste `Name, seat count` lines, get auto-generated passcodes back.
  - Guest list view: name, passcode, seat count, RSVP status, checked-in flag.
  - Live stats: total guests, accepted, declined, seats accepted, checked in.
- **Door scanner** — camera-based QR scan, single-use check-in (scanning the same QR twice is caught and flagged as a duplicate, not silently re-accepted).
- **Multi-event capable** — the data model should support more than one wedding existing at once, even though day-to-day it's usually just one live event at a time.

## 4. What went wrong in 101 — do not repeat

- **Google Apps Script as the backend.** This caused nearly every debugging session to turn into a scavenger hunt:
  - Confusion between a script *bound* to a Google Sheet vs. a *standalone* script project (`SpreadsheetApp.getActiveSpreadsheet()` silently returns `null` in the wrong context).
  - `Session.getActiveUser().getEmail()` returns an **empty string** for personal (non-Workspace) Gmail accounts under "Execute as: Me" — the exact mechanism used to gate the admin dashboard didn't reliably work for the admin's own account.
  - `execute as` (Me vs. "User accessing the web app") has real, non-obvious behavioral consequences that aren't clear from the UI.
  - `google.script.run` calls can silently hang forever with **no error surfaced at all** — no console error, no network failure, nothing — making failures nearly impossible to diagnose.
  - Net effect: hours spent fighting the platform instead of the product.
- **Google Sheets as the database.** Fine for a weekend prototype; not something to call "official."
- **Split hosting** — static assets on GitHub Pages, backend + admin/scanner HTML shells on Apps Script, cross-origin-loading CSS/JS between the two. Confusing to reason about, fragile to deploy (two separate Apps Script deployments with different access levels, both needing manual "new version" redeploys on every change).
- **Design as an afterthought** — the guest-facing invite page was visually plain (default serif card, minimal styling) and never got real art direction. This time, design should be part of the plan from day one, not something bolted on after the backend "works."

## 5. New direction for 103

- **Real, paid, officially-hosted deployment.** No more GitHub Pages. One coherent hosting story end to end (single provider for frontend + backend, if practical).
- **Tech stack: fully open.** Choose it fresh based on what actually fits this app's needs — don't default back to anything from 101.
- **Soft recommendation, not a mandate:** whatever backend gets chosen should give normal, debuggable request/response behavior — real error messages, real logs, no silent hangs, no identity-detection quirks. This is the single biggest lesson from 101; weight it heavily when picking a stack, but the actual choice is this project's to make fresh.
- **Design gets real attention up front** — mood, palette, typography, and motion should be deliberately chosen before or alongside the first build pass, not patched in afterward.

## 6. Non-goals

- Not a multi-tenant SaaS product (no self-serve signup, no billing, no multi-customer isolation) — it's a tool for one couple/admin at a time, unless that changes later.
- No payment processing.
- No guest self-service beyond passcode entry + RSVP (no guest accounts/login).
