require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const DIST = path.join(__dirname, '../frontend/dist');

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

initDb();

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/boards',  require('./routes/boards'));
app.use('/api/columns', require('./routes/columns'));
app.use('/api/cards',   require('./routes/cards'));
app.use('/api',         require('./routes/checklist'));
app.use('/api/habits',  require('./routes/habits'));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
