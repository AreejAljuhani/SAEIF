const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

router.post('/classify', (req, res) => {
    const patientData = req.body;
    
    // Extract all features from the form data
    const features = {
        group: patientData.personalInfo?.group || 1,
        sex: patientData.personalInfo?.sex || 1,
        age: patientData.personalInfo?.age || 0,
        arrival_mode: patientData.arrivalInfo?.arrival_mode || 1,
        injury: patientData.clinicalAssessment?.injury || 1,
        mental: patientData.clinicalAssessment?.mental || 1,
        pain: patientData.clinicalAssessment?.pain || 1,
        nrs_pain: patientData.clinicalAssessment?.nrs_pain || 0,
        sbp: patientData.vitalSigns?.sbp || 0,
        dbp: patientData.vitalSigns?.dbp || 0,
        hr: patientData.vitalSigns?.hr || 0,
        rr: patientData.vitalSigns?.rr || 0,
        bt: patientData.vitalSigns?.bt || 0,
        saturation: patientData.vitalSigns?.saturation || 0
    };
    
    // Convert features to comma-separated string for Python
    const featureString = Object.values(features).join(',');
    
    // Get chief complaint
    const chiefComplaint = patientData.chiefComplaint?.chief_complain || 'unknown';
    
    // Correct path to Python model
    const modelPath = path.join(__dirname, '..', '..', 'models', 'ctas_model.py');
    console.log('Model path:', modelPath);
    console.log('Calling ML model with features:', featureString);
    console.log('Chief complaint:', chiefComplaint);
    
    const py = spawn('python', [modelPath, featureString, chiefComplaint]);
    
    let output = '';
    let errorOutput = '';
    let responseSent = false;
    
    py.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    py.stderr.on('data', (err) => {
        errorOutput += err.toString();
        console.error('Python stderr:', err.toString());
    });
    
    py.on('close', (code) => {
        if (responseSent) return;
        responseSent = true;
        
        if (code !== 0) {
            console.error('Python process exited with code:', code);
            console.error('Error output:', errorOutput);
            return res.status(500).json({ error: 'Model prediction failed', details: errorOutput });
        }
        
        try {
            const result = JSON.parse(output.trim());
            res.json({ prediction: result });
        } catch (error) {
            console.error('Failed to parse model output:', output);
            res.json({ prediction: { prediction: parseInt(output.trim()) || 3 } });
        }
    });
    
    py.on('error', (error) => {
        if (responseSent) return;
        responseSent = true;
        console.error('Failed to start Python process:', error);
        res.status(500).json({ error: 'Failed to start ML model: ' + error.message });
    });
});

router.post('/patients/register', (req, res) => {
    // Save patient data to database and call classify endpoint
    const patientData = req.body;
    
    // TODO: Save to database
    console.log('Patient data received:', patientData);
    
    res.json({ 
        success: true, 
        message: 'Patient registered successfully',
        patientData: patientData
    });
});

module.exports = router;