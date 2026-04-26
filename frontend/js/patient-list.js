const patientListEl = document.getElementById("patientList");
const emptyStateEl  = document.getElementById("emptyState");
const searchInput   = document.getElementById("searchInput");
const ctasFilter    = document.getElementById("ctasFilter");
const genderFilter  = document.getElementById("genderFilter");

let allPatients = [];

db.collection("patients")
.orderBy("createdAt", "desc")
.onSnapshot(snapshot => {
  allPatients = [];

  snapshot.forEach(doc => {
    allPatients.push({ id: doc.id, ...doc.data() });
  });

  updateCTASCounts();
  renderPatients();

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

  const waitText = calcWaitTime(patient.createdAt);

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
        <span><i class="fas fa-clock"></i> Wait time: ${waitText}</span>
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

  return card;
}

function calcWaitTime(createdAt) {
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
  } catch (error) {
    console.error("Error updating patient status:", error);
    alert("Failed to update patient status. Please try again.");
  }
}