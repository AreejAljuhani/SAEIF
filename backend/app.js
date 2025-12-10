const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const classifyRoute = require('./routes/classify');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());

// API routes
app.use('/api', classifyRoute);

// Test endpoint
app.get('/', (req, res) => {
    res.json({ message: 'SAEIF Backend API is running', status: 'ok' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
