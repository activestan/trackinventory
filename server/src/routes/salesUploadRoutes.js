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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB is generous for a CSV of daily sales
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv'];
    const isCsv = allowedExtensions.some((ext) => file.originalname.toLowerCase().endsWith(ext));
    if (!isCsv) {
      return cb(new Error('Only .csv files are accepted for sales uploads.'));
    }
    cb(null, true);
  },
});

router.use(authenticate, authorize('Administrator', 'Manager'));

router.post('/', upload.single('file'), uploadSalesFile);
router.get('/', listSalesUploads);
router.get('/:id', getSalesUpload);

module.exports = router;
