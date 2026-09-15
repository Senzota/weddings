const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  // Nodemailer's defaults (2 min connection, socket, and greeting
  // timeouts) let one bad send tie up a connection far longer than a
  // gatepass email is worth failing fast on.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Never throws — gatepass delivery is a best-effort follow-up to a
// already-recorded RSVP, not a condition for accepting it.
async function sendGatepassEmail({ to, coupleNames, qrImageBuffer }) {
  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject: `Your gatepass for ${coupleNames}'s wedding`,
      text: 'Your RSVP is confirmed. Your QR gatepass is attached — please show it at the door.',
      attachments: [
        { filename: 'gatepass.png', content: qrImageBuffer, cid: 'gatepass' },
      ],
    });
    // Non-empty only for Ethereal test accounts — harmless elsewhere.
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log('Gatepass email preview:', previewUrl);
    return { sent: true };
  } catch (err) {
    console.error('Gatepass email failed to send:', err);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendGatepassEmail };
