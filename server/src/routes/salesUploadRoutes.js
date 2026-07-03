const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSalesFile, listSalesUploads, getSalesUpload } = require('../controllers/salesUploadController');

// Sales files are small (a day's worth of transactions) and are parsed
// entirely in memory rather than written to disk, since the deployed
// environment's filesystem is ephemeral.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB is generous for a day's sales, even as an Excel workbook
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const isAllowed = allowedExtensions.some((ext) => file.originalname.toLowerCase().endsWith(ext));
    if (!isAllowed) {
      return cb(new Error('Only .csv, .xlsx, and .xls files are accepted for sales uploads.'));
    }
    cb(null, true);
  },
});

router.use(authenticate, authorize('Administrator', 'Manager', 'Store Officer'));

router.post('/', upload.single('file'), uploadSalesFile);
router.get('/', listSalesUploads);
router.get('/:id', getSalesUpload);

module.exports = router;
