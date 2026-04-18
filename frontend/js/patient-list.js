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

  allPatients.forEach(p => {
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
  if (status === "monitoring") return "status-monitoring";
  if (status === "under-treatment") return "status-under-treatment";
  return "status-waiting";
}

function formatStatus(status) {
  if (status === "under-treatment") return "Under treatment";
  if (status === "monitoring") return "Monitoring";
  return "Waiting";
}