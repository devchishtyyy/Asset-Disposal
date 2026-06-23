'use strict';

// Load .env from the same directory as server.js, regardless of cwd
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const path       = require('path');

const authRoutes      = require('./routes/auth');
const adminRoutes     = require('./routes/admin');
const workflowRoutes  = require('./routes/workflows');
const sapRoutes       = require('./routes/sap');
const devRoutes       = require('./routes/dev');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Security headers ────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'none'"],
      scriptSrc:      ["'self'"],
      // 'unsafe-inline' for styles is required by several React UI libraries that
      // inject runtime <style> tags (e.g. Ant Design, MUI emotion runtime).
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'blob:'],
      connectSrc:     ["'self'"],
      formAction:     ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  // X-Frame-Options: DENY  (belt-and-suspenders alongside CSP frame-ancestors)
  frameguard:     { action: 'deny' },
  // HSTS — tell browsers to use HTTPS for 1 year (only meaningful behind TLS termination)
  hsts:           { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff:        true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Permissions-Policy — disable all browser features the app doesn't need.
// (helmet does not yet generate this header natively.)
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  next();
});

app.use(cors({
  origin:      process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));

// ── Body parsing ────────────────────────────────────────────────────────────────
// Increase limit to 50 MB to allow base64 signature/file uploads embedded in JSON
app.use(express.json({ limit: '50mb' }));

// Prevent browsers from caching any API response (auth tokens, user data, etc.)
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ── API routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/sap',       sapRoutes);

// Dev-only seed route
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRoutes);
}

// ── Production: serve the Vite build ───────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  // dist/ sits one level up from backend/ in both dev and portable layouts
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // SPA fallback — all non-API routes return index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store'); // never cache the SPA shell
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Global error handler ────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`\n  Asset Disposal API  ready on http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.JWT_SECRET) {
    console.warn('\n  ⚠  WARNING: JWT_SECRET is not set. Copy backend/.env.example → backend/.env and configure it.\n');
  }
});
