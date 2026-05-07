const API_URL = 'http://localhost:3000/api/crowding/predict';

// Load current crowding status 
async function loadCurrentStatus() {
  try {
    const res  = await fetch(API_URL);
    const data = await res.json();

    if (!data.success) return;

    const card  = document.getElementById('currentStatusCard');
    const icon  = document.getElementById('statusIcon');
    const level = document.getElementById('statusLevel');

    card.className = 'current-status-card';

    if (data.crowding_level === 0) {
      card.classList.add('level-low');
      icon.innerHTML = '<i class="fas fa-check-circle"></i>';
      level.textContent = 'Low';
    } else if (data.crowding_level === 1) {
      card.classList.add('level-medium');
      icon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
      level.textContent = 'Medium';
    } else {
      card.classList.add('level-high');
      icon.innerHTML = '<i class="fas fa-times-circle"></i>';
      level.textContent = 'High';
    }

    // Save alert to Firestore if High or Medium
    if (data.crowding_level >= 1) {
      saveCrowdingAlert(data);
    }

  } catch (err) {
    console.error('Status load error:', err);
  }
}

// Save crowding alert to Firestore 
async function saveCrowdingAlert(data) {
  const db = firebase.firestore();

  // Check if same level alert was saved in last 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  const existing = await db.collection('crowding_alerts')
    .where('crowding_level', '==', data.crowding_level)
    .where('createdAt', '>=', thirtyMinAgo.toISOString())
    .get();

  if (!existing.empty) return; // Already saved recently

  const f = data.features;

  await db.collection('crowding_alerts').add({
    crowding_level : data.crowding_level,
    crowding_label : data.crowding_label,
    probabilities  : data.probabilities,
    patient_count  : f.patient_count,
    avg_waiting_time: f.avg_waiting_time,
    high_acuity_ratio: f.high_acuity_ratio,
    doctors_available: f.doctors_available,
    beds_available  : f.beds_available,
    flow_pressure   : f.flow_pressure,
    rule_override   : data.rule_override || false,
    read            : false,
    createdAt       : new Date().toISOString(),
    timestamp       : firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Load alerts from Firestore 
function loadAlerts() {
  const db = firebase.firestore();

  db.collection('crowding_alerts')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(snapshot => {
      const active  = [];
      const history = [];

      snapshot.forEach(doc => {
        const alert = { id: doc.id, ...doc.data() };
        if (alert.read) {
          history.push(alert);
        } else {
          active.push(alert);
        }
      });

      renderAlerts(active, 'alertsList', false);
      renderAlerts(history, 'historyList', true);

      document.getElementById('alertCount').textContent = active.length;
    });
}

// Render alert cards 
function renderAlerts(alerts, containerId, isHistory) {
  const container = document.getElementById(containerId);

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="empty-alerts">
        <i class="fas fa-${isHistory ? 'inbox' : 'check-circle'}"></i>
        <p>${isHistory ? 'No alert history' : 'No active crowding alerts'}</p>
      </div>`;
    return;
  }

  container.innerHTML = alerts.map(alert => {
    const levelClass = alert.crowding_level === 2 ? 'level-high' : 'level-medium';
    const icon = alert.crowding_level === 2
      ? 'fas fa-times-circle'
      : 'fas fa-exclamation-circle';

    const time = alert.createdAt
      ? new Date(alert.createdAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : '—';

    const tags = [
      `Patients: ${alert.patient_count ?? '—'}`,
      `Wait: ${Math.round(alert.avg_waiting_time ?? 0)} min`,
      `High Acuity: ${((alert.high_acuity_ratio ?? 0) * 100).toFixed(0)}%`,
      `Beds: ${alert.beds_available ?? '—'}`,
      `Doctors: ${alert.doctors_available ?? '—'}`,
      `Flow: ${alert.flow_pressure > 0 ? '+' : ''}${Math.round(alert.flow_pressure ?? 0)}`,
    ].map(t => `<span class="alert-tag">${t}</span>`).join('');

    const readBtn = !isHistory
      ? `<button class="mark-read-btn" onclick="markAsRead('${alert.id}')">
           <i class="fas fa-check"></i> Dismiss
         </button>`
      : '';

    return `
      <div class="alert-card ${levelClass} ${alert.read ? 'read' : ''}">
        <div class="alert-card-left">
          <div class="alert-icon"><i class="${icon}"></i></div>
          <div>
            <div class="alert-title">
              Crowding Level: ${alert.crowding_label}
              ${alert.rule_override ? '<span class="alert-tag" style="background:#fef3c7">Rule Override</span>' : ''}
            </div>
            <div class="alert-message">
              ED crowding has reached ${alert.crowding_label} level — immediate attention may be required.
            </div>
            <div class="alert-tags">${tags}</div>
          </div>
        </div>
        <div>
          <div class="alert-time">${time}</div>
          ${readBtn}
        </div>
      </div>`;
  }).join('');
}

// Mark alert as read
async function markAsRead(alertId) {
  const db = firebase.firestore();
  await db.collection('crowding_alerts').doc(alertId).update({ read: true });
}

// Mark all as read 
async function clearAllAlerts() {
  const db = firebase.firestore();

  const snapshot = await db.collection('crowding_alerts')
    .where('read', '==', false)
    .get();

  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();
}

// Init 
loadCurrentStatus();
loadAlerts();

// Auto refresh every 2 minutes
setInterval(loadCurrentStatus, 120000);