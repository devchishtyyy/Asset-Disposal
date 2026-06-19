'use strict';

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = parseInt(process.env.PORT || '6001', 10);
const distPath = path.resolve(process.env.DIST_PATH || './dist');
const backendUrl = process.env.BACKEND_URL || 'http://localhost:6000';

app.use('/api', createProxyMiddleware({
  target: backendUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api',
  },
  logLevel: 'warn',
}));

app.use(express.static(distPath));
app.get('/*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
  console.log(`Proxying /api requests to ${backendUrl}`);
});
