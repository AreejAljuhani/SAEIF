const patientListEl = document.getElementById("patientList");
const emptyStateEl  = document.getElementById("emptyState");
const searchInput   = document.getElementById("searchInput");
const ctasFilter    = document.getElementById("ctasFilter");
const genderFilter  = document.getElementById("genderFilter");

// Ensure waiting time is calculated ONCE per patient and persisted.
const waitingTimeInFlight = new Set();

// ED Patient Board capacity (used for ETA + auto-promotion).
const DOCTORS_AVAILABLE = 2;

// Frontend fallback waiting-time calculator (uses Firebase client SDK).
const TRIAGE_AVG_TIMES = { 1: 0, 2: 10, 3: 20, 4: 30, 5: 40 };

function formatWaitingTime(minutes) {
  if (minutes === 0) return 'Immediate';
  if (minutes < 10) return '< 10 minutes';
  if (minutes < 30) return Math.round(minutes / 5) * 5 + ' minutes';
  if (minutes < 60) return Math.round(minutes / 5) * 5 + ' minutes';

  const hours = Math.ceil(minutes / 60);
  if (hours === 1) return '1 hour';
  if (hours <= 4) return hours + ' hours';
  return '4+ hours';
}

async function calculateWaitingTimeFromFirestore(triageLevel, doctorsAvailable = 2, excludePatientId = null) {
  const level = Number(triageLevel);
  const doctors = Number(doctorsAvailable) || 2;

  if (!Number.isFinite(level) || level < 1 || level > 5) {
    throw new Error('Invalid triage level');
  }

  const snapshot = await db.collection('patients')
    .where('status', '==', 'waiting')
    .get();

  let patientsAhead = 0;
  snapshot.forEach(doc => {
    if (excludePatientId && doc.id === excludePatientId) return;

    const data = doc.data() || {};
    const otherLevel = Number(data.triageLevel || data.finalCTAS || data.aiCTAS);
    if (Number.isFinite(otherLevel) && otherLevel <= level) {
      patientsAhead++;
    }
  });

  const effectiveQueue = doctors > 0 ? patientsAhead / doctors : patientsAhead;
  const avgTime = TRIAGE_AVG_TIMES[level] ?? 30;
  const waitingTimeMinutes = Math.ceil(effectiveQueue * avgTime);

  return {
    waitingTimeMinutes,
    waitingTimeFormatted: formatWaitingTime(waitingTimeMinutes),
    patientsAhead,
    details: {
      effectiveQueue: Number(effectiveQueue.toFixed(2)),
      averageTime: avgTime,
      availableDoctors: doctors,
      formula: `(${patientsAhead} ÷ ${doctors}) × ${avgTime}min = ${waitingTimeMinutes}min`
    }
  };
}

function getLevelFromDocData(data) {
  return Number(data?.triageLevel || data?.finalCTAS || data?.aiCTAS);
}

function getArrivalMsFromDocData(data) {
  const arrival = data?.arrivalTime;
  if (arrival && typeof arrival.toDate === 'function') {
    try { return arrival.toDate().getTime(); } catch (_) {}
  }

  const createdAt = data?.createdAt;
  if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    if (!Number.isNaN(parsed)) return parsed;
  }

  if (createdAt && typeof createdAt.toDate === 'function') {
    try { return createdAt.toDate().getTime(); } catch (_) {}
  }

  return Date.now();
}

let waitingTimeRecalcTimer = null;

function scheduleQueueWaitingTimeRecalc() {
  if (waitingTimeRecalcTimer) window.clearTimeout(waitingTimeRecalcTimer);
  waitingTimeRecalcTimer = window.setTimeout(() => {
    recalculateWaitingTimesForQueue().catch(err => console.warn('Queue ETA recalc failed:', err));
  }, 250);
}

async function recalculateWaitingTimesForQueue() {
  // Read queue state (waiting + in_progress) and compute ETAs by actual queue order:
  // priority (CTAS asc) then arrival time.
  const [waitingSnap, inProgressSnap] = await Promise.all([
    db.collection('patients').where('status', '==', 'waiting').get(),
    db.collection('patients').where('status', '==', 'in_progress').get()
  ]);

  const waitingDocs = [];
  waitingSnap.forEach(doc => waitingDocs.push({ id: doc.id, data: doc.data() || {} }));
  if (waitingDocs.length === 0) return;

  const busyDoctors = inProgressSnap.size;
  const availableDoctors = Math.max(0, DOCTORS_AVAILABLE - busyDoctors);
  const denomDoctors = availableDoctors > 0 ? availableDoctors : 1;

  waitingDocs.sort((a, b) => {
    const la = getLevelFromDocData(a.data);
    const lb = getLevelFromDocData(b.data);
    if (la !== lb) return (la || 999) - (lb || 999);
    return getArrivalMsFromDocData(a.data) - getArrivalMsFromDocData(b.data);
  });

  const nowIso = new Date().toISOString();
  const updates = waitingDocs.map(({ id, data }, index) => {
    const lvl = getLevelFromDocData(data);
    if (!Number.isFinite(lvl) || lvl < 1 || lvl > 5) return Promise.resolve();

    const patientsAhead = index;
    const effectiveQueue = patientsAhead / denomDoctors;
    const avgTime = TRIAGE_AVG_TIMES[lvl] ?? 30;
    const waitingTimeMinutes = Math.ceil(effectiveQueue * avgTime);
    const formatted = formatWaitingTime(waitingTimeMinutes);

    const existingMinutes = Number(data.waitingTimeMinutes);
    const existingFormatted = String(data.waitingTimeFormatted || '');
    const sameExisting = Number.isFinite(existingMinutes) && existingMinutes === waitingTimeMinutes && existingFormatted === formatted;
    if (sameExisting) {
      const el = document.getElementById(`wait-${id}`);
      if (el) el.textContent = formatted;
      return Promise.resolve();
    }

    const payload = {
      waitingTimeTriageLevel: lvl,
      waitingTimeMinutes,
      waitingTimeFormatted: formatted,
      waitingTimeCalculatedAt: nowIso,
      waitingTimeDoctorsAvailable: availableDoctors,
      waitingTimePatientsAhead: patientsAhead,
      waitingTimeDetails: {
        effectiveQueue: Number(effectiveQueue.toFixed(2)),
        averageTime: avgTime,
        availableDoctors,
        formula: `(${patientsAhead} ÷ ${availableDoctors}) × ${avgTime}min = ${waitingTimeMinutes}min`
      }
    };

    const el = document.getElementById(`wait-${id}`);
    if (el) el.textContent = formatted;

    return db.collection('patients').doc(id).update(payload).catch(err => {
      console.warn('Could not persist waiting time update for patient:', id, err);
    });
  });

  await Promise.allSettled(updates);
}

async function promoteNextWaitingPatient(excludePatientId) {
  // Only promote if there is capacity.
  const inProgressSnap = await db.collection('patients')
    .where('status', '==', 'in_progress')
    .get();

  if (inProgressSnap.size >= DOCTORS_AVAILABLE) return null;

  const waitingSnap = await db.collection('patients')
    .where('status', '==', 'waiting')
    .get();

  const candidates = [];
  waitingSnap.forEach(doc => {
    if (excludePatientId && doc.id === excludePatientId) return;
    const data = doc.data() || {};
    const lvl = getLevelFromDocData(data);
    if (!Number.isFinite(lvl) || lvl < 1 || lvl > 5) return;
    candidates.push({ id: doc.id, data });
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const la = getLevelFromDocData(a.data);
    const lb = getLevelFromDocData(b.data);
    if (la !== lb) return la - lb;
    return getArrivalMsFromDocData(a.data) - getArrivalMsFromDocData(b.data);
  });

  const next = candidates[0];
  await db.collection('patients').doc(next.id).update({
    status: 'in_progress',
    statusUpdatedAt: new Date()
  });

  return next.id;
}

let allPatients = [];

let lastQueueSignature = null;

function getQueueSignature(patients) {
  // Only include fields that represent queue composition (not waitingTime fields).
  const parts = (patients || [])
    .filter(p => p && (p.status === 'waiting' || p.status === 'in_progress'))
    .map(p => {
      const lvl = getLevelFromDocData(p);
      const arrival = getArrivalMsFromDocData(p);
      return `${p.id}:${p.status}:${Number.isFinite(lvl) ? lvl : 'x'}:${arrival}`;
    })
    .sort();

  return parts.join('|');
}

db.collection("patients")
.orderBy("createdAt", "desc")
.onSnapshot(snapshot => {
  allPatients = [];

  snapshot.forEach(doc => {
    allPatients.push({ id: doc.id, ...doc.data() });
  });

  updateCTASCounts();
  renderPatients();

  const sig = getQueueSignature(allPatients);
  if (sig !== lastQueueSignature) {
    lastQueueSignature = sig;
    scheduleQueueWaitingTimeRecalc();
  }

}, error => {
  console.error("Error loading patients:", error);
});

searchInput.addEventListener("input", renderPatients);
ctasFilter.addEventListener("change", renderPatients);
genderFilter.addEventListener("change", renderPatients);

function updateCTASCounts() {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // Only count patients that are NOT completed
  allPatients.forEach(p => {
    if (p.status === "completed") return; // Skip completed patients
    
    const level = Number(p.finalCTAS || p.aiCTAS);
    if (counts[level] !== undefined) counts[level]++;
  });

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById("count-" + i);
    if (el) el.textContent = counts[i];
  }
}

function renderPatients() {
  const searchVal  = searchInput.value.trim().toLowerCase();
  const ctasVal    = ctasFilter.value;
  const genderVal  = genderFilter.value;

  const filtered = allPatients.filter(p => {
    const name   = (p.name || "").toLowerCase();
    const level  = String(p.finalCTAS || p.aiCTAS || "");
    const gender = p.sex === "1" ? "Female" : p.sex === "2" ? "Male" : "";

    const matchName   = !searchVal || name.includes(searchVal);
    const matchCTAS   = ctasVal === "all" || level === ctasVal;
    const matchGender = genderVal === "all" || gender === genderVal;

    return matchName && matchCTAS && matchGender;
  });

  // Sort: in_progress first, then waiting, then completed
  filtered.sort((a, b) => {
    const statusOrder = { in_progress: 0, waiting: 1, completed: 2 };
    const aOrder = statusOrder[a.status] ?? 3;
    const bOrder = statusOrder[b.status] ?? 3;
    return aOrder - bOrder;
  });

  patientListEl.innerHTML = "";

  if (filtered.length === 0) {
    emptyStateEl.style.display = "flex";
    return;
  }

  emptyStateEl.style.display = "none";
  filtered.forEach(p => patientListEl.appendChild(buildCard(p)));
}

function buildCard(patient) {
  const card = document.createElement("div");

  const ctasLevel  = Number(patient.finalCTAS || patient.aiCTAS) || 0;
  const name       = patient.name || "Unknown";
  const age        = patient.age  || "–";
  const gender     = patient.sex === "1" ? "Female" : patient.sex === "2" ? "Male" : "–";
  const status     = patient.status || "waiting";
  const isMonitoring = patient.monitoring === true;
  const complaint  = patient.chiefComplaint?.chief_complain || patient.chiefComplaint || "–";

  // Prefer stored waiting time (calculated once at registration)
  const storedWaitText = patient.waitingTimeFormatted;
  const waitText = storedWaitText || (status === 'waiting' ? '–' : '–');

  card.className = `patient-card ctas-${ctasLevel}`;

  card.innerHTML = `
    <div class="patient-avatar">
      <i class="fas fa-user"></i>
    </div>

    <div class="patient-info">
      <div class="patient-name-row">
        <span class="patient-name">${name}</span>
        <span class="status-badge ${getStatusClass(status)}">${formatStatus(status)}</span>
        ${isMonitoring ? `<span class="iot-badge"><i class="fas fa-heartbeat"></i> IoT</span>` : ""}
      </div>

      <div class="patient-meta">
        <span><i class="fas fa-birthday-cake"></i> ${age} years old</span>
        <span><i class="fas fa-venus-mars"></i> ${gender}</span>
        <span><i class="fas fa-clock"></i> Wait time: <span id="wait-${patient.id}" class="wait-time-text">${waitText}</span></span>
      </div>

      <div class="patient-complaint">
        <span class="complaint-label">Chief Complaint</span>${complaint}
      </div>

      <div class="patient-status-controls">
        <button class="status-btn waiting-btn ${status === 'waiting' ? 'active' : ''}" 
                onclick="updatePatientStatus('${patient.id}', 'waiting')">
          <i class="fas fa-hourglass-start"></i> Waiting
        </button>
        <button class="status-btn progress-btn ${status === 'in_progress' ? 'active' : ''}" 
                onclick="updatePatientStatus('${patient.id}', 'in_progress')">
          <i class="fas fa-stethoscope"></i> In Progress
        </button>
        <button class="status-btn completed-btn ${status === 'completed' ? 'active' : ''}" 
                onclick="updatePatientStatus('${patient.id}', 'completed')">
          <i class="fas fa-check-circle"></i> Completed
        </button>
      </div>
    </div>

    <span class="ctas-pill ctas-${ctasLevel}">CTAS ${ctasLevel || "--"}</span>
  `;

  // Backward-compatibility: if an older record has no stored waiting time,
  // calculate it ONCE and persist it back to Firestore.
  // Also: if a stored value exists but is likely wrong (e.g., "Immediate" for CTAS>1
  // while other waiting patients exist), recalculate and overwrite.
  const shouldRecalculateStored = (() => {
    if (!ctasLevel || status !== 'waiting' || !patient.id) return false;

    const storedLevel = Number(patient.waitingTimeTriageLevel);
    const sameLevel = !Number.isFinite(storedLevel) || storedLevel === Number(ctasLevel);
    const isImmediate = String(storedWaitText || '').trim().toLowerCase() === 'immediate';

    if (!storedWaitText) return true;
    if (!sameLevel) return true;

    // If backend couldn't read Firestore, older records got saved as Immediate.
    // If there are other patients waiting with same/higher priority, Immediate is suspicious.
    if (Number(ctasLevel) > 1 && isImmediate) {
      return allPatients.some(p => {
        if (!p || p.id === patient.id) return false;
        if (p.status !== 'waiting') return false;
        const lvl = Number(p.triageLevel || p.finalCTAS || p.aiCTAS);
        return Number.isFinite(lvl) && lvl <= Number(ctasLevel);
      });
    }

    return false;
  })();

  if (shouldRecalculateStored) {
    ensureWaitingTimeStored(patient.id, ctasLevel, true)
      .then(value => {
        const waitElement = card.querySelector(`#wait-${patient.id}`);
        if (waitElement && value) waitElement.textContent = value;
      })
      .catch(err => console.warn('Could not store wait time:', err));
  }

  return card;
}

function calcWaitTime(createdAt, triageLevel) {
  if (!createdAt || !triageLevel) return "–";

  try {
    // Use realistic waiting time calculation (via API)
    // This replaces the old "time elapsed" calculation
    return calculateRealisticWaitTime(triageLevel);
  } catch {
    return "–";
  }
}

async function ensureWaitingTimeStored(patientId, triageLevel, force = false) {
  try {
    if (waitingTimeInFlight.has(patientId)) return null;
    waitingTimeInFlight.add(patientId);

    // Forced mode: compute from Firestore client so values update even if a stored value exists.
    if (force) {
      const computed = await calculateWaitingTimeFromFirestore(triageLevel, DOCTORS_AVAILABLE, patientId);
      const value = computed.waitingTimeFormatted || '–';

      await db.collection('patients').doc(patientId).update({
        waitingTimeTriageLevel: Number(triageLevel),
        waitingTimeMinutes: computed.waitingTimeMinutes,
        waitingTimeFormatted: value,
        waitingTimeCalculatedAt: new Date().toISOString(),
        waitingTimeDoctorsAvailable: DOCTORS_AVAILABLE,
        waitingTimePatientsAhead: computed.patientsAhead,
        waitingTimeDetails: computed.details || null
      });

      return value;
    }

    const response = await fetch('http://localhost:3000/api/calculate-waiting-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triageLevel: Number(triageLevel),
        doctorsAvailable: DOCTORS_AVAILABLE,
        excludePatientId: patientId
      })
    });

    if (response.ok) {
      const data = await response.json();

      let computed = data;
      if (Number(triageLevel) > 1 && Number(data.patientsAhead) === 0) {
        try {
          computed = await calculateWaitingTimeFromFirestore(triageLevel, DOCTORS_AVAILABLE, patientId);
        } catch (fallbackError) {
          console.warn('Waiting time Firestore fallback failed:', fallbackError);
          computed = data;
        }
      }

      const value = computed.waitingTimeFormatted || data.waitingTimeFormatted || '–';

      await db.collection('patients').doc(patientId).update({
        waitingTimeTriageLevel: Number(triageLevel),
        waitingTimeMinutes: computed.waitingTimeMinutes,
        waitingTimeFormatted: value,
        waitingTimeCalculatedAt: new Date().toISOString(),
        waitingTimeDoctorsAvailable: DOCTORS_AVAILABLE,
        waitingTimePatientsAhead: computed.patientsAhead,
        waitingTimeDetails: computed.details || data.details || null
      });

      return value;
    }

    // If API is not ok, fall back to computing from Firestore client.
    try {
      const computed = await calculateWaitingTimeFromFirestore(triageLevel, DOCTORS_AVAILABLE, patientId);
      const value = computed.waitingTimeFormatted || '–';
      await db.collection('patients').doc(patientId).update({
        waitingTimeTriageLevel: Number(triageLevel),
        waitingTimeMinutes: computed.waitingTimeMinutes,
        waitingTimeFormatted: value,
        waitingTimeCalculatedAt: new Date().toISOString(),
        waitingTimeDoctorsAvailable: DOCTORS_AVAILABLE,
        waitingTimePatientsAhead: computed.patientsAhead,
        waitingTimeDetails: computed.details || null
      });
      return value;
    } catch (fallbackError) {
      console.warn('Waiting time Firestore fallback failed (API not ok):', fallbackError);
    }

    return '–';
  } catch (error) {
    console.warn('Error calculating wait time:', error);
    return '–';
  } finally {
    waitingTimeInFlight.delete(patientId);
  }
}

function calcWaitTime_OLD(createdAt) {
  if (!createdAt) return "–";

  try {
    const created = new Date(createdAt);
    const diff    = Math.floor((Date.now() - created.getTime()) / 60000);

    if (diff < 1) return "Just now";
    if (diff < 60) return diff + " min";

    const hrs  = Math.floor(diff / 60);
    const mins = diff % 60;

    return hrs + "h " + (mins > 0 ? mins + "m" : "");
  } catch {
    return "–";
  }
}

function getStatusClass(status) {
  if (status === "in_progress") return "status-in-progress";
  if (status === "completed") return "status-completed";
  return "status-waiting";
}

function formatStatus(status) {
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  return "Waiting";
}

// Update patient status in Firebase
async function updatePatientStatus(patientId, newStatus) {
  try {
    await db.collection("patients").doc(patientId).update({
      status: newStatus,
      statusUpdatedAt: new Date()
    });
    
    console.log(`Patient ${patientId} status updated to: ${newStatus}`);

    if (newStatus === 'completed') {
      try {
        await promoteNextWaitingPatient(patientId);
      } catch (error) {
        console.warn('Could not auto-promote next waiting patient:', error);
      }
    }

    scheduleQueueWaitingTimeRecalc();
  } catch (error) {
    console.error("Error updating patient status:", error);
    alert("Failed to update patient status. Please try again.");
  }
}