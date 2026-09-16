const cloudinary = require('cloudinary').v2;

// Reads CLOUDINARY_URL from the environment automatically — no explicit
// key/secret wiring needed, same as how DATABASE_URL works for pg.
cloudinary.config({ secure: true });

function uploadImage(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

// Same image, but with a response header that makes the browser save it
// instead of navigating to it — Cloudinary's fl_attachment delivery flag,
// inserted right after /upload/ in the URL. No new storage or API call.
function getDownloadUrl(imageUrl) {
  return imageUrl.replace('/upload/', '/upload/fl_attachment/');
}

module.exports = { uploadImage, deleteImage, getDownloadUrl };
