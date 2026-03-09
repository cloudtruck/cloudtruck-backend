import multer from 'multer';
import { FILE_UPLOAD } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';

// Use memory storage — no local filesystem dependency (required for deployed environments)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  if (FILE_UPLOAD.ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type ${file.mimetype} not allowed`), false);
  }
};

// Multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_UPLOAD.MAX_SIZE,
    files: FILE_UPLOAD.MAX_FILES
  }
});

export default upload;
