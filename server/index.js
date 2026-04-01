require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db'); // initializes tables synchronously

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/prices', require('./routes/prices'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/accounts', require('./routes/accounts'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RestoSuite AI',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍽️  RestoSuite AI running on http://0.0.0.0:${PORT}`);
});
