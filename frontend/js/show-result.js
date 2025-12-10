document.addEventListener("DOMContentLoaded", () => {
  // Retrieve data from sessionStorage
  const triageResultStr = sessionStorage.getItem('triageResult');
  const patientDataStr = sessionStorage.getItem('patientData');
  
  if (!triageResultStr || !patientDataStr) {
    // No result data - show error or redirect
    document.querySelector('.patient-name').textContent = 'No data found';
    document.querySelector('.ctas-number').textContent = '--';
    document.querySelector('.ctas-desc').textContent = 'Please register a patient first';
    return;
  }
  
  try {
    const triageResult = JSON.parse(triageResultStr);
    const patientData = JSON.parse(patientDataStr);
    
    // Display patient information
    const patientName = patientData.personalInfo?.name || 'Unknown';
    document.getElementById('patientName').textContent = patientName;
    
    // Display patient info summary
    const genderMap = { '1': 'Female', '2': 'Male' };
    const arrivalModeMap = {
      '1': 'Walking', '2': '119 use', '3': 'Private car', '4': 'Private ambulance',
      '5': 'Public transportation', '6': 'Wheelchair', '7': 'Others'
    };
    
    document.getElementById('displayAge').textContent = patientData.personalInfo?.age || '--';
    document.getElementById('displayGender').textContent = genderMap[patientData.personalInfo?.sex] || '--';
    document.getElementById('displayArrivalMode').textContent = arrivalModeMap[patientData.arrivalInfo?.arrival_mode] || '--';
    document.getElementById('patientInfo').style.display = 'block';
    
    // Display CTAS prediction (handles object shape from backend)
    const rawPrediction = triageResult?.prediction;
    const predictionValue = (rawPrediction && typeof rawPrediction === 'object')
      ? rawPrediction.prediction
      : rawPrediction;
    const numericPrediction = Number(predictionValue);
    const prediction = Number.isFinite(numericPrediction) ? numericPrediction : '--';
    const ctasDescriptions = {
      1: 'Critical - Immediate resuscitation',
      2: 'Emergent - High urgency',
      3: 'Urgent - Moderate urgency',
      4: 'Semi-urgent - Lower urgency',
      5: 'Non-urgent - Least urgency'
    };
    
    const waitingTimes = {
      1: 'Immediate',
      2: '<10 minutes',
      3: '30 minutes',
      4: '1-2 hours',
      5: '2 hours'
    };
    
    document.getElementById('ctasLevel').textContent = prediction;
    document.getElementById('ctasDescription').textContent = ctasDescriptions[prediction] || 'Unknown classification';
    document.getElementById('waitingTime').textContent = waitingTimes[prediction] || '--';
    
    // Update CTAS card class for styling
    const ctasCard = document.getElementById('ctasCard');
    ctasCard.className = `ctas-card ctas-${prediction}`;
    
    // Display confidence if available
    const confidence = (rawPrediction && typeof rawPrediction === 'object')
      ? rawPrediction.confidence
      : triageResult.confidence;
    if (confidence !== undefined && confidence !== null) {
      const confidencePercent = (Number(confidence) * 100).toFixed(1);
      document.getElementById('confidenceValue').textContent = confidencePercent + '%';
      document.getElementById('confidenceBox').style.display = 'block';
    }
    
    console.log('Triage result displayed:', triageResult);
    
  } catch (error) {
    console.error('Error parsing result data:', error);
    document.querySelector('.ctas-desc').textContent = 'Error displaying results';
  }
  
  // Handle confirm button
  const confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      alert('Result confirmed successfully.');
      // TODO: Send confirmation to backend
      // Clear session data
      sessionStorage.removeItem('triageResult');
      sessionStorage.removeItem('patientData');
      // Redirect to home or patient list
      // window.location.href = 'home.html';
    });
  }
  
  // Handle data export for later use
  window.getTriageResult = () => {
    return JSON.parse(sessionStorage.getItem('triageResult'));
  };
  
  window.getPatientData = () => {
    return JSON.parse(sessionStorage.getItem('patientData'));
  };
});
