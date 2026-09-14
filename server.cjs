const express = require('express');
const path = require('path');
const { apiRouter } = require('./server-api.cjs');

const app = express();
const PORT = 3000;

app.use('/api', apiRouter);

// Serve static build from dist
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
