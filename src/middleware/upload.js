const multer = require("multer");
const path = require("path");
const fs = require("fs");

// izven src/ (in izven Docker image-a), da lahko postane volumen in preživi rebuild
const uploadDir = path.join(__dirname, "..", "..", "uploads", "avatars");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Dovoljene so samo slikovne datoteke"));
  }
  cb(null, true);
}

const uploadAvatar = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

module.exports = { uploadAvatar, uploadDir };
