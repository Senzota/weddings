const multer = require('multer');

// Memory storage, not disk — files go straight to Cloudinary from the
// buffer in the controller. Render's disk is ephemeral and wipes on every
// deploy/restart, which is exactly the bug this replaces.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPEG, or WEBP images are allowed.'));
  },
});

module.exports = upload;
