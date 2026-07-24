require('dotenv').config();
const validateEnv = require('./utils/validateEnv');

validateEnv();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { startAlertScheduler } = require('./jobs/alertScheduler');

// Route modules
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const assetRoutes = require('./routes/assetRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportRoutes = require('./routes/reportRoutes');
const salesUploadRoutes = require('./routes/salesUploadRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');

const app = express();

// Render (and most hosting platforms) sit behind a reverse proxy, so
// every incoming request carries an X-Forwarded-For header set by that
// proxy, not by the actual client. Without telling Express to trust
// this proxy, express-rate-limit (used below on login/password-reset)
// refuses to trust that header for identifying clients and throws a
// fatal ValidationError on every rate-limited request - which was
// crashing the entire process in production. Trusting exactly one hop
// (the platform's own proxy) is what the express-rate-limit docs
// recommend, since blindly trusting `true` would let a malicious client
// spoof their own X-Forwarded-For header and bypass rate limiting
// entirely.
app.set('trust proxy', 1);

// ---- Global middleware ----
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Inventory & Asset Tracking API is running.' });
});

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sales-uploads', salesUploadRoutes);
app.use('/api/activity-log', activityLogRoutes);

// ---- 404 handler ----
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ---- Global error handler ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Multer surfaces file upload issues (size limit exceeded, wrong file
  // type from the fileFilter check) as errors passed to next(), rather
  // than throwing inside the route handler, so they are handled here.
  if (err && (err.name === 'MulterError' || /\.xls files are accepted/.test(err.message || ''))) {
    return res.status(400).json({ message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'An unexpected server error occurred.' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  startAlertScheduler();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
