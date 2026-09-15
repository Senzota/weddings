const gatepassModel = require('../models/gatepass.model');

function showScanner(req, res) {
  res.render('scan/scanner');
}

async function verify(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ result: 'invalid', message: 'No token provided.' });

  const gatepass = await gatepassModel.findByToken(token);
  if (!gatepass) {
    return res.status(404).json({ result: 'invalid', message: 'This QR code is not recognized.' });
  }

  const { result } = await gatepassModel.checkIn(token);
  if (result === 'checked_in') {
    return res.json({ result, message: `${gatepass.name} checked in.`, guestName: gatepass.name });
  }
  return res.json({ result, message: `${gatepass.name}'s pass was already scanned.`, guestName: gatepass.name });
}

module.exports = { showScanner, verify };
