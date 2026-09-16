const QRCode = require('qrcode');
const { randomUUID } = require('crypto');

function generateQrToken() {
  return randomUUID();
}

async function generateQrImageBuffer(token) {
  return QRCode.toBuffer(token, { type: 'png', margin: 2, width: 400 });
}

// For rendering the gatepass directly on the page — an <img> src that
// needs no separate route or stored file.
async function generateQrDataUrl(token) {
  return QRCode.toDataURL(token, { margin: 2, width: 400 });
}

module.exports = { generateQrToken, generateQrImageBuffer, generateQrDataUrl };
