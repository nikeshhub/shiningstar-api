import multer from 'multer';
import path from 'path';

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png/;
  const validExt = allowed.test(path.extname(file.originalname).toLowerCase());
  const validMime = /jpeg|jpg|png/.test(file.mimetype);

  if (validExt && validMime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png) are allowed!'));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

// Generic: pass any field definitions, e.g. uploadFields([{ name: 'photo', maxCount: 1 }])
export const uploadFields = (fields) => upload.fields(fields);
