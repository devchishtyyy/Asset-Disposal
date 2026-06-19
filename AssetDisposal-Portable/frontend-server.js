'use strict';

const express = require('express');
const path = require('path');

const app = express();
const port = parseInt(process.env.PORT || '6001', 10);
const distPath = path.resolve(process.env.DIST_PATH || './dist');

app.use(express.static(distPath));
app.get('/*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Frontend server running at http://localhost:${port}`);
});
