const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    const err = new Error('Only JPEG and PNG files are allowed');
    err.status = 400;
    cb(err, false);
  }
};

const storage = process.env.NODE_ENV === 'test'
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, 'uploads/payment-proofs/'),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${uuidv4()}${ext}`);
      }
    });

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});
