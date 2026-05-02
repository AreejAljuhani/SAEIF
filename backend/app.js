const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin BEFORE loading routes
if (!admin.apps.length) {
    try {
        const serviceAccount = require('./serviceAccount.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.warn('⚠️  Firebase already initialized or config missing:', error.message);
        console.log('ℹ️  If using real Firebase, set FIREBASE_PROJECT_ID environment variable');
    }
}

// NOW load routes (after Firebase is initialized)
const classifyRoute = require('./routes/classify');
const crowdingRoute = require('./routes/crowding');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());

// API routes
app.use('/api', classifyRoute);
app.use('/api/crowding', crowdingRoute);

// Test endpoint
app.get('/', (req, res) => {
    res.json({ message: 'SAEIF Backend API is running', status: 'ok' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));