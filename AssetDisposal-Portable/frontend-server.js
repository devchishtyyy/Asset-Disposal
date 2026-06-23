'use strict';

const express = require('express');
const path    = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app        = express();
const port       = parseInt(process.env.PORT || '6003', 10);
const distPath   = path.resolve(process.env.DIST_PATH || './dist');
const backendUrl = process.env.BACKEND_URL || 'http://localhost:6002';

// ── Security headers ────────────────────────────────────────────────────────────
// Applied to every response served by this process (static files + SPA fallback).
// The /api proxy responses get overwritten by backend headers, so these only
// meaningfully affect HTML, JS, CSS, and font responses.

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  // 'unsafe-inline' covers runtime style injection used by many React UI libs.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join('; ');

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy',          CSP);
  res.setHeader('X-Frame-Options',                  'DENY');
  res.setHeader('X-Content-Type-Options',           'nosniff');
  res.setHeader('Referrer-Policy',                  'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',               'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  // HSTS is only enforced when the connection is already HTTPS (TLS terminator / IIS).
  res.setHeader('Strict-Transport-Security',        'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-DNS-Prefetch-Control',           'off');
  res.setHeader('Cross-Origin-Opener-Policy',       'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy',     'same-origin');
  next();
});

// ── API proxy ───────────────────────────────────────────────────────────────────
app.use('/api', createProxyMiddleware({
  target:      backendUrl,
  changeOrigin: true,
  pathRewrite: { '^/api': '/api' },
  logLevel:    'warn',
}));

// ── Static assets ───────────────────────────────────────────────────────────────
// Vite outputs hashed filenames (e.g. index-CNluxwLo.js) which are safe to cache
// long-term. The HTML shell must never be cached so users always get the latest
// asset URLs after a deployment.
app.use(express.static(distPath, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

// ── SPA fallback ────────────────────────────────────────────────────────────────
// No-store prevents the browser from serving a stale HTML shell after logout or
// a new deployment, which would otherwise show protected content or wrong assets.
app.get('/*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
  console.log(`Proxying /api requests to ${backendUrl}`);
});
