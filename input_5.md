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

*(Claude Code: note anything unexpected here.)*
