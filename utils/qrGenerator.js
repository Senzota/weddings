const QRCode = require('qrcode');
const { randomUUID } = require('crypto');

function generateQrToken() {
  return randomUUID();
}

async function generateQrImageBuffer(token) {
  return QRCode.toBuffer(token, { type: 'png', margin: 2, width: 400 });
}

module.exports = { generateQrToken, generateQrImageBuffer };
