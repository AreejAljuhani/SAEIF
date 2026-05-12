const express = require('express');
const router  = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const admin = require('firebase-admin');

// Init Firebase Admin (once) 
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccount.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Helper: compute features from Firestore 
async function computeFeatures() {
  const now   = new Date();
  const hour  = now.getHours();
  const dow   = now.getDay() === 0 ? 7 : now.getDay();
  const isWeekend = (dow >= 6) ? 1 : 0;
  const month = now.getMonth() + 1;
  const fluSeason = (month >= 11 || month <= 3) ? 1 : 0;

  // Patients 
  const patientsSnap = await db.collection('patients').get();
  const patients = patientsSnap.docs.map(d => d.data());

  const activePatients = patients.filter(p =>
    p.status === 'waiting' || 
    p.status === 'under-treatment' || 
    p.status === 'in_progress'
);

  const patient_count = activePatients.length;

  // avg_ctas
  const ctasVals = activePatients
    .map(p => parseFloat(p.finalCTAS || p.aiCTAS || 3))
    .filter(v => !isNaN(v));
  const avg_ctas = ctasVals.length
    ? ctasVals.reduce((a, b) => a + b, 0) / ctasVals.length
    : 3;

  // high_acuity_ratio (CTAS 1-2)
  const highAcuity = ctasVals.filter(v => v <= 2).length;
  const high_acuity_ratio = ctasVals.length ? highAcuity / ctasVals.length : 0;

  // waiting times - createdAt or arrivalTime
  const waitingTimes = activePatients
    .map(p => {
      const startTime = p.waitingStartTime || p.arrivalTime || p.createdAt;
      if (!startTime) return null;
      const start = startTime?.toDate ? startTime.toDate() : new Date(startTime);
      return (now - start) / 60000;
    })
    .filter(v => v !== null && v >= 0 && v < 1440);

  const avg_waiting_time = waitingTimes.length
    ? waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length
    : 0;
  const max_waiting_time = waitingTimes.length
    ? Math.max(...waitingTimes)
    : 0;

  // arrival_rate: patients created in last hour
  const oneHourAgo = new Date(now - 3600000);
  const arrival_rate = patients.filter(p =>
    p.createdAt && new Date(p.createdAt) >= oneHourAgo
  ).length;

  // discharge_rate: patients discharged in last hour
  const discharge_rate = patients.filter(p =>
    (p.status === 'discharged' || p.status === 'completed') &&
    p.updatedAt && new Date(p.updatedAt) >= oneHourAgo
).length;

  // Resources 
  const resDoc = await db.collection('settings').doc('resources').get();
  const res    = resDoc.exists ? resDoc.data() : {};

  const doctors_available = res.doctorsAvailable || 0;
  const nurses_available  = res.nursesAvailable  || 0;
  const beds_available    = res.bedsAvailable    || 0;
  const is_holiday        = res.isHoliday        || 0;

  // Weather 
  let temperature = 30;
  try {
    const fetch = (await import('node-fetch')).default;
    const apiKey = process.env.WEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=Jeddah,SA&appid=${apiKey}&units=metric`;
    const weatherRes = await fetch(url);
    const weatherData = await weatherRes.json();
    temperature = weatherData?.main?.temp || 30;
  } catch (e) {
    console.log('Weather API unavailable, using default temperature:', temperature);
  }

  // Engineered features 
  const flow_pressure      = arrival_rate - discharge_rate;
  const bed_pressure       = patient_count / (beds_available + 1);
  const staff_burden       = patient_count / (doctors_available + 1);
  const staff_burden_ratio = doctors_available / (nurses_available + 1);
  const wait_pressure      = avg_waiting_time / (max_waiting_time + 1);
  const acuity_load        = high_acuity_ratio * patient_count;

  return {
    hour, day_of_week: dow, is_weekend: isWeekend,
    patient_count, avg_ctas, high_acuity_ratio,
    avg_waiting_time, max_waiting_time,
    doctors_available, nurses_available, beds_available,
    arrival_rate, discharge_rate,
    is_holiday, flu_season: fluSeason, temperature,
    flow_pressure, bed_pressure, staff_burden,
    staff_burden_ratio, wait_pressure, acuity_load
  };
}

// Rule-based override helper 
function applyRuleOverride(result, features) {
  const f = features;
  let highScore = 0;
  let medScore  = 0;

  if (f.beds_available    <=  3)  highScore++;
  if (f.doctors_available <=  2)  highScore++;
  if (f.avg_waiting_time  >  45)  highScore++;
  if (f.high_acuity_ratio > 0.5)  highScore++;
  if (f.flow_pressure     >   8)  highScore++;

  if (f.beds_available    <=  8)  medScore++;
  if (f.doctors_available <=  4)  medScore++;
  if (f.avg_waiting_time  >  25)  medScore++;
  if (f.high_acuity_ratio > 0.3)  medScore++;
  if (f.flow_pressure     >   4)  medScore++;

  if (highScore >= 2 && result.crowding_level < 2) {
    result.crowding_level = 2;
    result.crowding_label = 'High';
    result.probabilities  = { Low: 5.0, Medium: 15.0, High: 80.0 };
    result.rule_override  = true;
  } else if (medScore >= 2 && result.crowding_level < 1) {
    result.crowding_level = 1;
    result.crowding_label = 'Medium';
    result.probabilities  = { Low: 20.0, Medium: 65.0, High: 15.0 };
    result.rule_override  = true;
  }

  return result;
}

// POST /api/crowding/predict 
router.post('/predict', async (req, res) => {
  try {
    const features  = await computeFeatures();
    const modelPath = path.join(__dirname, '..', '..', 'models', 'crowding_model.py');

    const py = spawn('python', [modelPath, JSON.stringify(features)]);

    let output = '', errorOutput = '';

    py.stdout.on('data', d => output += d.toString());
    py.stderr.on('data', d => errorOutput += d.toString());

    py.on('close', code => {
      if (code !== 0) {
        console.error('Python error:', errorOutput);
        return res.status(500).json({ error: 'Model prediction failed', details: errorOutput });
      }
      try {
        const result = applyRuleOverride(JSON.parse(output.trim()), features);
        res.json({ success: true, ...result, features });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse model output', raw: output });
      }
    });

    py.on('error', err => {
      res.status(500).json({ error: 'Failed to start Python: ' + err.message });
    });

  } catch (err) {
    console.error('computeFeatures error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/crowding/predict 
router.get('/predict', async (req, res) => {
  try {
    const features  = await computeFeatures();
    const modelPath = path.join(__dirname, '..', '..', 'models', 'crowding_model.py');

    const py = spawn('python', [modelPath, JSON.stringify(features)]);

    let output = '', errorOutput = '';

    py.stdout.on('data', d => output += d.toString());
    py.stderr.on('data', d => errorOutput += d.toString());

    py.on('close', code => {
      if (code !== 0) {
        console.error('Python error:', errorOutput);
        return res.status(500).json({ error: 'Model prediction failed', details: errorOutput });
      }
      try {
        const result = applyRuleOverride(JSON.parse(output.trim()), features);
        res.json({ success: true, ...result, features });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse model output', raw: output });
      }
    });

    py.on('error', err => {
      res.status(500).json({ error: 'Failed to start Python: ' + err.message });
    });

  } catch (err) {
    console.error('computeFeatures error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;