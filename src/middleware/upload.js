const multer = require("multer");
const path = require("path");
const fs = require("fs");

// izven src/ (in izven Docker image-a), da lahko postane volumen in preživi rebuild
const avatarDir = path.join(__dirname, "..", "..", "uploads", "avatars");
const logoDir = path.join(__dirname, "..", "..", "uploads", "logos");
fs.mkdirSync(avatarDir, { recursive: true });
fs.mkdirSync(logoDir, { recursive: true });

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Dovoljene so samo slikovne datoteke"));
  }
  cb(null, true);
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  }
});

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `org-${req.user.organization_id}-${Date.now()}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 3 MB
});

module.exports = { uploadAvatar, uploadLogo, avatarDir, logoDir };
