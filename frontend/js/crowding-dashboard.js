const API_URL = 'http://localhost:3000/api/crowding/predict';

// Load prediction 
async function loadPrediction() {
  try {
    // Spin refresh icon
    document.getElementById('refreshIcon').classList.add('fa-spin');

    const res  = await fetch(API_URL);
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    updateBanner(data);
    updateStats(data.features);
    updateFeaturesTable(data.features);
    updateRecommendations(data);

    // Last updated time
    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  } catch (err) {
    console.error('Prediction error:', err);
    document.getElementById('crowdingLabel').textContent = 'Error loading data';
  } finally {
    document.getElementById('refreshIcon').classList.remove('fa-spin');
  }
}

// ── Update banner ─────────────────────────────────────
function updateBanner(data) {
  const banner  = document.getElementById('crowdingBanner');
  const label   = document.getElementById('crowdingLabel');
  const icon    = document.getElementById('bannerIcon');
  const level   = data.crowding_level;
  const lbl     = data.crowding_label;

  // Remove old classes
  banner.className = 'crowding-banner';

  if (level === 0) {
    banner.classList.add('level-low');
    icon.innerHTML = '<i class="fas fa-check-circle"></i>';
  } else if (level === 1) {
    banner.classList.add('level-medium');
    icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
  } else {
    banner.classList.add('level-high');
    icon.innerHTML = '<i class="fas fa-times-circle"></i>';
  }

  label.textContent = lbl;

  // Probabilities
  const p = data.probabilities;
  document.getElementById('probLow').textContent  = p.Low  + '%';
  document.getElementById('probMed').textContent  = p.Medium + '%';
  document.getElementById('probHigh').textContent = p.High + '%';
  document.getElementById('probLowBar').style.width  = p.Low  + '%';
  document.getElementById('probMedBar').style.width  = p.Medium + '%';
  document.getElementById('probHighBar').style.width = p.High + '%';
}

// Update stat cards 
function updateStats(f) {
  document.getElementById('statPatients').textContent   = f.patient_count ?? '—';
  document.getElementById('statWaiting').textContent    = f.avg_waiting_time != null
    ? Math.round(f.avg_waiting_time) : '—';
  document.getElementById('statHighAcuity').textContent = f.patient_count != null
    ? Math.round(f.high_acuity_ratio * f.patient_count) : '—';
  document.getElementById('statDoctors').textContent    = f.doctors_available ?? '—';
  document.getElementById('statBeds').textContent       = f.beds_available ?? '—';

  const flow = f.flow_pressure != null ? Math.round(f.flow_pressure) : null;
  const flowEl = document.getElementById('statFlow');
  flowEl.textContent = flow != null ? (flow > 0 ? '+' + flow : flow) : '—';
  flowEl.style.color = flow > 0 ? '#e53e3e' : flow < 0 ? '#38a169' : '#718096';
}

// Features table 
function updateFeaturesTable(f) {
  const rows = [
    ['Hour',              f.hour],
    ['Day of Week',       f.day_of_week],
    ['Weekend',           f.is_weekend ? 'Yes' : 'No'],
    ['Patient Count',     f.patient_count],
    ['Avg CTAS',          f.avg_ctas?.toFixed(2)],
    ['High Acuity Ratio', (f.high_acuity_ratio * 100)?.toFixed(1) + '%'],
    ['Avg Wait (min)',    f.avg_waiting_time?.toFixed(1)],
    ['Max Wait (min)',    f.max_waiting_time?.toFixed(1)],
    ['Doctors',           f.doctors_available],
    ['Nurses',            f.nurses_available],
    ['Beds',              f.beds_available],
    ['Arrival Rate',      f.arrival_rate],
    ['Discharge Rate',    f.discharge_rate],
    ['Holiday',           f.is_holiday ? 'Yes' : 'No'],
    ['Flu Season',        f.flu_season ? 'Yes' : 'No'],
    ['Temperature',       f.temperature?.toFixed(1) + '°C'],
    ['Flow Pressure',     f.flow_pressure?.toFixed(1)],
    ['Bed Pressure',      f.bed_pressure?.toFixed(2)],
    ['Staff Burden',      f.staff_burden?.toFixed(2)],
  ];

  const container = document.getElementById('featuresTable');
  container.innerHTML = rows.map(([name, val]) => `
    <div class="feature-row">
      <span class="feature-name">${name}</span>
      <span class="feature-value">${val ?? '—'}</span>
    </div>
  `).join('');
}

// Recommendations 
function updateRecommendations(data) {
  const f     = data.features;
  const level = data.crowding_level;
  const recs  = [];

  if (level === 2) {
    recs.push('Activate surge protocol — crowding is HIGH');
    recs.push('Call in additional doctors and nurses immediately');
  }

  if (f.beds_available < 5) {
    recs.push('Critical bed shortage — expedite patient discharge');
  }

  if (f.flow_pressure > 10) {
    recs.push('Arrival rate significantly exceeds discharge rate');
  }

  if (f.avg_waiting_time > 60) {
    recs.push('Average wait exceeds 60 min — prioritize triage');
  }

  if (f.high_acuity_ratio > 0.3) {
    recs.push('High proportion of CTAS 1-2 patients — allocate senior staff');
  }

  if (f.doctors_available < 3) {
    recs.push('Less than 3 doctors available — request backup');
  }

  if (level === 0 && recs.length === 0) {
    recs.push('ED is operating normally — no immediate action required');
    recs.push('Continue monitoring patient flow every 30 minutes');
  }

  if (level === 1 && recs.length === 0) {
    recs.push('Moderate crowding — monitor closely for changes');
    recs.push('Ensure discharge process is running efficiently');
  }

  const container = document.getElementById('recommendations');
  container.innerHTML = recs.map((r, i) => `
    <div class="rec-item">
      <div class="rec-num">${i + 1}</div>
      <div>${r}</div>
    </div>
  `).join('');
}

//  Auto refresh every 2 minutes 
loadPrediction();
setInterval(loadPrediction, 120000);