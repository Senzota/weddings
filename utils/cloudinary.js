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

module.exports = { uploadImage, deleteImage };
