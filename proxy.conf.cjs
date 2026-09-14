const express = require('express');
const { apiRouter } = require('./server-api.cjs');

const app = express();
// Enable CORS for safety
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api', apiRouter);

try {
  const server = app.listen(3001, '127.0.0.1', () => {
    console.log('[API Proxy] Server listening on http://127.0.0.1:3001');
  });
  server.on('error', (err) => {
    if (err.code !== 'EADDRINUSE') {
      console.error('[API Proxy] Server error:', err);
    }
  });
} catch (e) {
  console.warn('[API Proxy] Listen exception:', e);
}

module.exports = {
  '/api': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    secure: false
  }
};
