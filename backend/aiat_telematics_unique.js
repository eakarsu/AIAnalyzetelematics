const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Validate required env vars at startup
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`FATAL: Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn('WARNING: JWT_SECRET should be at least 32 characters for security');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// Gzip compression for all responses
app.use(compression());

// CORS: env-driven allowed origins
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// General rate limiter for all routes — 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});
app.use(generalLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/fuel', require('./routes/fuel'));
app.use('/api/safety', require('./routes/safety'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/geofences', require('./routes/geofences'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/analytics', require('./routes/analytics'));

// Serve frontend build for SPA (when no separate dev server)
const fs = require('fs');
const FRONT_BUILD = path.resolve(__dirname, '../frontend/build');
if (fs.existsSync(FRONT_BUILD)) {
  app.use(express.static(FRONT_BUILD));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(FRONT_BUILD, 'index.html')));
}

// Health check — verifies DB connectivity
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./db');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message, timestamp: new Date().toISOString() });
  }
});

// Global error handler — never leak stack traces to clients
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FleetIQ Backend running on port ${PORT}`);
});

// BATCH_00_AUDIT_MOUNTS
app.use('/api/telematics-stream', require('./routes/telematicsStream'));
app.use('/api/driver-mobile', require('./routes/driverMobile'));
app.use('/api/av-readiness', require('./routes/avReadiness'));
app.use('/api/ml-fuel', require('./routes/mlFuel'));
app.use('/api/telematics-bridge', require('./routes/telematicsBridge'));

// === Batch 00 Gaps & Frontend Mounts ===
app.use('/api/gap-ai-driver-coaching-content-behavior', require('./routes/gap_ai_driver_coaching_content_behavior'));
app.use('/api/gap-ai-load-optimization-weight-cargo', require('./routes/gap_ai_load_optimization_weight_cargo'));
app.use('/api/gap-ai-streaming-telematics-anomaly-detection', require('./routes/gap_ai_streaming_telematics_anomaly_detection'));
app.use('/api/gap-ai-predictive-accident-prevention', require('./routes/gap_ai_predictive_accident_prevention'));
app.use('/api/gap-vehicle-obd-ii-can-bus', require('./routes/gap_vehicle_obd_ii_can_bus'));
app.use('/api/gap-eld-electronic-logging-device-compliance', require('./routes/gap_eld_electronic_logging_device_compliance'));
app.use('/api/gap-customer-proof-delivery-photos-signatures', require('./routes/gap_customer_proof_delivery_photos_signatures'));
app.use('/api/gap-notifications-subsystem', require('./routes/gap_notifications_subsystem'));
app.use('/api/gap-outbound-webhooks', require('./routes/gap_outbound_webhooks'));
app.use('/api/gap-mobile-driver-app', require('./routes/gap_mobile_driver_app'));

// Custom Views (Telematics) - 2 viz + 2 non-viz
app.use('/api/custom-views', require('./routes/customViews'));
