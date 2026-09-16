# Input 5 — Scanner Discoverability and Cross-Device Compatibility

Found by live testing: the door-scanner page works, but there's no way to reach it
from the app, and it hasn't been checked across different devices/browsers.

## 1. Add a link/button to the scanner page

Right now `/scan` exists but nothing in the UI points to it — the admin has to know
the URL by memory. Fix:

- Add a **"Door Scanner"** link/button on the main admin dashboard (the "Your
  Weddings" list page), since the scanner already works across all events (it looks
  up the gatepass by its token, which is unique regardless of which wedding it
  belongs to — no event ID needed in the URL).
- Also add the same link on each individual event's dashboard, for convenience,
  next to the existing "Shareable Invite Link" section.
- Give it a **Copy Link** button too (same pattern as the invite link), since the
  admin will likely hand this URL to door staff on the wedding day (via WhatsApp,
  etc.) rather than operate the scanner personally.

Open question for Claude Code to resolve based on how auth currently works: does
`/scan` require an admin login? If door staff are meant to be a separate role from
the admin (per ARCHITECTURE.md's Guest/Admin/Door-staff roles) and won't have admin
credentials, `/scan` should be reachable and usable without logging in as admin —
confirm this is already the case, or adjust if `/scan` currently sits behind
admin-only auth.

## 2. Make the scanner work reliably across devices

The camera-based scanner needs to work on whatever device is actually at the door
on the wedding day — phones, tablets, laptops, different browsers — not just
whatever was used to build/test it. Specifically:

- **Default to the rear/back camera** on phones and tablets (`facingMode:
  "environment"` in the `getUserMedia` constraints), not the front-facing camera —
  the front camera is what most browsers default to and it's impractical for
  scanning something held up in front of the device.
- **Handle devices with multiple cameras** (e.g. a laptop with only a front camera,
  or a tablet with both) — if only one camera is available, use it; if more than
  one, default to rear-facing but don't break if that facing mode isn't available.
- **Responsive layout** — the camera preview and surrounding page must scale
  correctly on a small phone screen in portrait orientation as well as a tablet or
  laptop in landscape, without the video feed being cropped or hard to see.
- **Confirm it works on both major mobile browsers** — Android Chrome and iOS
  Safari — since these have historically had different quirks around camera
  permissions and `getUserMedia`. iOS Safari in particular requires HTTPS (already
  true on Render) and a direct user tap to start the camera — confirm the "start
  scanning" action is triggered by an explicit button tap, not automatically on
  page load.
- **Graceful failure** — if camera access is denied, unavailable, or unsupported on
  a given device/browser, show a clear message explaining what to do (e.g. "Camera
  access is required — check your browser's permission settings") instead of a
  blank or broken page.
- **Manual code entry as a backup** — add a simple fallback text input on the
  scanner page where a gatepass code can be typed in and checked in manually, for
  the case where a camera won't cooperate on the day. This should run through the
  exact same check-in/duplicate-detection logic as a camera scan, just with the
  code typed instead of decoded from an image.

## Suggested verification

- From the admin dashboard, confirm the Door Scanner link is visible and the Copy
  Link button works.
- Confirm `/scan` is reachable and usable without an admin login (or note here if
  it's intentionally admin-only and that's fine).
- Test the scanner on at least one Android phone (Chrome) and one iPhone (Safari):
  camera starts on the rear lens, permission prompts behave correctly, a real QR
  code scans and checks the guest in.
- Test on a laptop with a webcam — confirm it still works with only a front-facing
  camera available.
- Deny camera permission deliberately and confirm a clear error message shows
  instead of a blank page.
- Use the manual code entry fallback to check in a guest without using the camera,
  confirm it behaves identically to a camera scan (including duplicate detection).

## Issues found

**Open question resolved:** `/scan` was already reachable without an admin
login — `routes/scan.routes.js` never had `requireAdmin` on it (only the
`/admin/*` routes do). No change needed there; door staff can already use
the scanner without admin credentials, matching the Guest/Admin/Door-staff
role split in ARCHITECTURE.md.

**What was verified locally (via curl/DB, not a real device):**
- `GET /scan` returns 200 with no auth cookie at all.
- "Door Scanner" link + Copy Link button render on both the main "Your
  Weddings" list and each event's dashboard, next to the shareable invite
  link, with the correct absolute URL.
- Manual code entry and camera-decoded scans hit the exact same
  `/scan/verify` endpoint via the same `verifyToken()` function — confirmed
  by exercising that endpoint directly: a fresh gatepass token checks in
  cleanly, a repeat of the same token is flagged as a duplicate rather than
  re-admitted. There's no separate manual-entry code path to drift out of
  sync with the camera path.

**What could NOT be verified from here — needs a human on real hardware:**
This environment has no camera and no device farm, so the actual
`getUserMedia` behavior described in the spec (rear-camera preference,
graceful fallback on a front-camera-only laptop, iOS Safari's
tap-to-start requirement, permission-denied messaging, responsive video
sizing on a real small screen) is implemented per the platform's
documented constraint semantics and known iOS/Android quirks, but **not
exercised on an actual Android Chrome, iOS Safari, or laptop-webcam
device**. Specifically worth someone checking by hand before relying on
it at a real door:
- Camera actually defaults to the rear lens on a real phone.
- The "Start Scanning" button actually satisfies iOS Safari's
  user-gesture requirement (this is the one iOS is strict about — a
  script-initiated `getUserMedia` call with no button tap silently fails
  there, which the old auto-start code would have hit).
- Denying the permission prompt on a real device shows the intended
  message rather than a generic browser error screen.
- The video preview actually looks right (not cropped, not tiny) on a
  real small phone screen in portrait.

Please test on whatever devices will actually be at the door before the
wedding, and report back anything that doesn't match the above so it can
be fixed with real device feedback instead of guessing further from here.
