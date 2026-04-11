import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const studentPhotosDir = path.join(uploadsDir, 'student-photos');
const birthCertificatesDir = path.join(uploadsDir, 'birth-certificates');

[uploadsDir, studentPhotosDir, birthCertificatesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'photo') {
      cb(null, studentPhotosDir);
    } else if (file.fieldname === 'birthCertificate') {
      cb(null, birthCertificatesDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png/;
  const allowedDocTypes = /jpeg|jpg|png|pdf/;

  const extname = file.fieldname === 'birthCertificate'
    ? allowedDocTypes.test(path.extname(file.originalname).toLowerCase())
    : allowedImageTypes.test(path.extname(file.originalname).toLowerCase());

  const mimetype = file.fieldname === 'birthCertificate'
    ? /jpeg|jpg|png|pdf/.test(file.mimetype)
    : /jpeg|jpg|png/.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error(`Only ${file.fieldname === 'birthCertificate' ? 'images and PDFs' : 'images'} are allowed!`));
  }
};

// Multer upload configuration
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Middleware for handling student documents
export const uploadStudentDocuments = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'birthCertificate', maxCount: 1 }
]);
