const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');

router.post('/classify', (req, res) => {
    const { age, hr, bp } = req.body;

    const py = spawn('python', ['../models/ctas_model.py', age, hr, bp]);

    py.stdout.on('data', (data) => {
        res.json({ prediction: data.toString().trim() });
    });

    py.stderr.on('data', (err) => {
        console.error(err.toString());
        res.status(500).send(err.toString());
    });
});

module.exports = router;