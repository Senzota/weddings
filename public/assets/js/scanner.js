const statusEl = document.getElementById('status');
const video = document.getElementById('preview');
const startBtn = document.getElementById('start-btn');
const manualForm = document.getElementById('manual-form');
const manualCodeInput = document.getElementById('manual-code');

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Prevents firing another /scan/verify request for every remaining frame
// the same QR code sits in view — one decode triggers one verify, then a
// short cooldown before the loop looks for the next code.
let scanning = false;

// iOS Safari requires getUserMedia to be triggered by a direct user
// gesture — starting the camera automatically on page load silently fails
// there, so this only ever runs from the button's click handler.
startBtn.addEventListener('click', startCamera);

async function startCamera() {
  startBtn.disabled = true;
  statusEl.textContent = 'Requesting camera access...';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = 'Camera scanning is not supported in this browser. Use the manual code entry below instead.';
    startBtn.hidden = true;
    return;
  }

  let stream;
  try {
    // A bare (non-"exact") facingMode is an *ideal* constraint — browsers
    // fall back to whatever camera is available (e.g. a laptop with only
    // a front-facing camera) rather than failing outright, but a plain
    // {video: true} retry below covers any browser that isn't lenient
    // about it.
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (err) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (fallbackErr) {
      showCameraError(fallbackErr);
      return;
    }
  }

  video.srcObject = stream;
  video.classList.add('active');
  startBtn.hidden = true;
  statusEl.textContent = "Point the camera at a guest's QR gatepass.";
  scanning = true;
  requestAnimationFrame(tick);
}

function showCameraError(err) {
  startBtn.disabled = false;
  let message = 'Camera access is required — check your browser\'s permission settings.';
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    message = 'No camera was found on this device. Use the manual code entry below instead.';
  } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    message = 'Camera access was denied. Check your browser\'s site permissions and try again, or use the manual code entry below.';
  } else if (err.name === 'NotReadableError') {
    message = 'The camera could not be started (it may be in use by another app). Use the manual code entry below instead.';
  }
  statusEl.textContent = message;
}

function tick() {
  if (scanning && video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      verifyToken(code.data);
    }
  }
  requestAnimationFrame(tick);
}

manualForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = manualCodeInput.value.trim();
  if (!code) return;
  manualCodeInput.value = '';
  verifyToken(code);
});

// Shared by both the camera decode path and the manual entry form — same
// check-in/duplicate-detection logic either way, since /scan/verify only
// ever sees a token string and doesn't know where it came from.
async function verifyToken(token) {
  scanning = false; // pause camera decoding during the request either way
  statusEl.textContent = 'Checking...';
  try {
    const res = await fetch('/scan/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    statusEl.textContent = data.message;
  } catch (err) {
    statusEl.textContent = `Network error: ${err.message}`;
  }
  setTimeout(() => { scanning = true; }, 2000);
}
