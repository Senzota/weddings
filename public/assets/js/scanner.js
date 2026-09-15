const statusEl = document.getElementById('status');
const video = document.getElementById('preview');

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// Prevents firing another /scan/verify request for every remaining frame
// the same QR code sits in view — one decode triggers one verify, then a
// short cooldown before the loop looks for the next code.
let scanning = true;

navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  .then((stream) => {
    video.srcObject = stream;
    requestAnimationFrame(tick);
  })
  .catch((err) => { statusEl.textContent = `Camera error: ${err.message}`; });

function tick() {
  if (scanning && video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      scanning = false;
      verifyToken(code.data);
    }
  }
  requestAnimationFrame(tick);
}

async function verifyToken(token) {
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
