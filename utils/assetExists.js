const fs = require('fs');
const path = require('path');

// input_16 §4: Lady Gianna's floral corner images are supplied as fixed
// static files, added directly to the repo once available — not a
// generated/admin-uploaded asset. Guarding with this before rendering an
// <img> means a template can reference the final expected path today
// without producing a broken-image icon until the file actually lands.
function assetExists(publicPath) {
  return fs.existsSync(path.join(__dirname, '..', 'public', publicPath));
}

module.exports = { assetExists };
