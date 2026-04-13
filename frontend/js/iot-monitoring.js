const monitorGrid = document.getElementById("monitorGrid");
const emptyState  = document.getElementById("emptyState");

console.log("monitorGrid element found:", monitorGrid);

let alertsCount = 0;
let selectedPatientId = null;
let selectedPatientName = null;
let selectedReason = null;

db.collection("patients")
.where("monitoring", "==", true)
.onSnapshot(snapshot => {
  console.log("Query result - monitored patients:", snapshot.size);

  monitorGrid.innerHTML = "";
  alertsCount = 0;

  if (snapshot.size === 0) {
    emptyState.style.display = "flex";
  } else {
    emptyState.style.display = "none";

    snapshot.forEach(doc => {
      const patient = doc.data();
      const patientId = doc.id;

      console.log("Patient:", patient.name, "ID:", patientId);
      createPatientCard(patientId, patient);
    });
  }

}, error => {
  console.error("Firebase error:", error);
});

function createPatientCard(id, patient) {
  const card = document.createElement("div");
  card.className = "monitor-card";
  card.setAttribute("data-patient-id", id);

  const deviceId = patient.deviceInfo?.deviceId || "D1";
  const ctasLevel = patient.finalCTAS || patient.aiCTAS || "–";
  const patientName = patient.name || "Unknown Patient";
  const patientAge = patient.age || "–";

  const patientGender =
    patient.sex === "1" ? "Female" :
    patient.sex === "2" ? "Male" : "–";

  const ctasClass =
    (ctasLevel === 2 || ctasLevel === "2") ? "ctas-2" : "ctas-3";

  card.innerHTML = `
    <div class="monitor-header">
      <div>
        <div class="monitor-patient-name">${patientName}</div>
        <div class="monitor-patient-meta">Age: ${patientAge} | ${patientGender}</div>
        <span class="ctas-pill-badge ${ctasClass}">CTAS ${ctasLevel}</span>
      </div>
      <div class="device-badge"><i class="fas fa-watch"></i> ${deviceId}</div>
    </div>

    <div class="vitals">
      <div class="vital-box" id="card-hr-box-${id}">
        <div class="vital-label">HR</div>
        <div class="vital-value" id="hr-${id}">${patient.vitalSigns?.hr || "--"}</div>
      </div>

      <div class="vital-box" id="card-spo2-box-${id}">
        <div class="vital-label">SpO2</div>
        <div class="vital-value" id="spo2-${id}">${patient.vitalSigns?.saturation || "--"}</div>
      </div>

      <div class="vital-box" id="card-temp-box-${id}">
        <div class="vital-label">Temp</div>
        <div class="vital-value" id="temp-${id}">${patient.vitalSigns?.bt || "--"}</div>
      </div>
    </div>

    <div class="status-row">
      <div id="status-${id}" class="status-live">LIVE</div>
      <div id="alert-summary-${id}" class="alert-summary"></div>
    </div>

    <div class="click-hint">
      <i class="fas fa-hand-pointer"></i> Tap to view details
    </div>
  `;

  card.addEventListener("click", () => openDetailsModal(id, patient));

  monitorGrid.appendChild(card);
  listenToDevice(id);
}

function openDetailsModal(patientId, patient) {
  selectedPatientId = patientId;
  selectedPatientName = patient.name || "Unknown";

  const ctasLevel = patient.finalCTAS || patient.aiCTAS || "–";
  const patientAge = patient.age || "–";
  const deviceId = patient.deviceInfo?.deviceId || "D1";

  const patientGender =
    patient.sex === "1" ? "Female" :
    patient.sex === "2" ? "Male" : "–";

  document.getElementById("modal-name").textContent = selectedPatientName;
  document.getElementById("modal-age").textContent = patientAge;
  document.getElementById("modal-gender").textContent = patientGender;
  document.getElementById("modal-ctas").textContent = "CTAS " + ctasLevel;
  document.getElementById("modal-device").textContent = deviceId;

  const hrEl = document.getElementById("hr-" + patientId);
  const spo2El = document.getElementById("spo2-" + patientId);
  const tempEl = document.getElementById("temp-" + patientId);

  const hr = hrEl ? hrEl.innerText : "–";
  const spo2 = spo2El ? spo2El.innerText : "–";
  const temp = tempEl ? tempEl.innerText : "–";

  setModalVital("modal-hr", "modal-hr-box", "modal-hr-note", hr, hr > 120, "High HR");
  setModalVital("modal-spo2", "modal-spo2-box", "modal-spo2-note", spo2, spo2 < 92, "Low SpO2");
  setModalVital("modal-temp", "modal-temp-box", "modal-temp-note", temp, temp > 38, "High Temp");

  rebuildModalAlerts(hr, spo2, temp);

  document.getElementById("detailsModal").classList.add("open");
}

function setModalVital(valueId, boxId, noteId, value, isAlert, noteText) {
  const valEl = document.getElementById(valueId);
  const boxEl = document.getElementById(boxId);
  const noteEl = document.getElementById(noteId);

  if (valEl) {
    valEl.textContent = value;
    valEl.className = "modal-vital-value" + (isAlert ? " alert-value" : "");
  }

  if (boxEl) {
    boxEl.className = "modal-vital-item" + (isAlert ? " alert-vital" : "");
  }

  if (noteEl) {
    noteEl.textContent = noteText;
  }
}

function rebuildModalAlerts(hr, spo2, temp) {
  const box = document.getElementById("modal-alert-box");
  const listEl = document.getElementById("modal-alert-list");

  const alerts = [];

  if (hr > 120) alerts.push("High Heart Rate (" + hr + " bpm)");
  if (spo2 < 92) alerts.push("Low Oxygen Saturation (" + spo2 + "%)");
  if (temp > 38) alerts.push("High Temperature (" + temp + "°C)");

  if (alerts.length > 0) {
    listEl.innerHTML = alerts.map(a =>
      `<div class="modal-alert-item">${a}</div>`
    ).join("");
    box.classList.add("has-alerts");
  } else {
    box.classList.remove("has-alerts");
  }
}

function closeDetailsModal() {
  document.getElementById("detailsModal").classList.remove("open");
}

function openStopModal() {
  selectedReason = null;

  document.querySelectorAll(".reason-btn")
    .forEach(b => b.classList.remove("selected"));

  document.getElementById("confirmStopBtn").disabled = true;

  document.getElementById("detailsModal").classList.remove("open");
  document.getElementById("stopModal").classList.add("open");
}

function closeStopModal() {
  document.getElementById("stopModal").classList.remove("open");
  document.getElementById("detailsModal").classList.add("open");
}

function selectReason(btn) {
  document.querySelectorAll(".reason-btn")
    .forEach(b => b.classList.remove("selected"));

  btn.classList.add("selected");
  selectedReason = btn.getAttribute("data-reason");

  document.getElementById("confirmStopBtn").disabled = false;
}

function confirmStop() {
  if (!selectedPatientId || !selectedReason) return;

  const patientId = selectedPatientId;
  const patientName = selectedPatientName;
  const reason = selectedReason;

  const deviceUserId = "cGcoHXzRoocdqjltwr3PQWwYA6C3";
  const realtimeDb = firebase.database();

  realtimeDb.ref("UsersData/" + deviceUserId + "/linkedPatientId").remove();

  db.collection("patients")
    .doc(patientId)
    .set({
      monitoring: false,
      status: "waiting",
      monitoringEndedAt: new Date().toISOString(),
      stopReason: reason,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    .then(() => {
      console.log("Patient disconnected:", patientName);
      document.getElementById("stopModal").classList.remove("open");
    })
    .catch(error => {
      console.error("Error disconnecting:", error);
      alert("Failed to disconnect");
    });
}

function listenToDevice(patientId) {
  const deviceUserId = "cGcoHXzRoocdqjltwr3PQWwYA6C3";
  const realtimeDb = firebase.database();

  let lastUpdate = Date.now();

  realtimeDb.ref("UsersData/" + deviceUserId + "/vitals")
    .on("value", snapshot => {

      const data = snapshot.val();

      if (document.getElementById(`hr-${patientId}`)) {
        document.getElementById(`hr-${patientId}`).innerText = data?.heartRate || "--";
        document.getElementById(`spo2-${patientId}`).innerText = data?.spo2 || "--";
        document.getElementById(`temp-${patientId}`).innerText = data?.temperature || "--";

        updateCardVitalStyle(`card-hr-box-${patientId}`, `hr-${patientId}`, data?.heartRate > 120);
        updateCardVitalStyle(`card-spo2-box-${patientId}`, `spo2-${patientId}`, data?.spo2 < 92);
        updateCardVitalStyle(`card-temp-box-${patientId}`, `temp-${patientId}`, data?.temperature > 38);
      }

      lastUpdate = Date.now();
      checkAlerts(patientId, data);
    });

  setInterval(() => {
    if (Date.now() - lastUpdate > 30000) {
      const status = document.getElementById(`status-${patientId}`);
      if (status) {
        status.innerText = "DISCONNECTED";
        status.className = "status-off";
      }
    }
  }, 5000);
}

function updateCardVitalStyle(boxId, valueId, isAlert) {
  const box = document.getElementById(boxId);
  const val = document.getElementById(valueId);

  if (box) box.className = "vital-box" + (isAlert ? " alert-vital" : "");
  if (val) val.className = "vital-value" + (isAlert ? " alert-value" : "");
}

const alertCooldowns = {};

function checkAlerts(id, data) {
  const alertItems = [];

  if (data?.heartRate > 120) alertItems.push("High Heart Rate");
  if (data?.spo2 < 92) alertItems.push("Low Oxygen Saturation");
  if (data?.temperature > 38) alertItems.push("High Temperature");

  const isDeteriorating = alertItems.length > 0;

  const summaryEl = document.getElementById(`alert-summary-${id}`);
  if (summaryEl) {
    summaryEl.textContent = isDeteriorating
      ? `${alertItems.length} alert${alertItems.length > 1 ? "s" : ""}`
      : "";
  }

  const now = Date.now();
  const lastWrite = alertCooldowns[id] || 0;

  if (isDeteriorating && (now - lastWrite) > 60000) {
    alertCooldowns[id] = now;

    db.collection("patients").doc(id).get().then(doc => {
      if (!doc.exists) return;

      const patient = doc.data();

      db.collection("alerts").add({
        patientId: id,
        patientName: patient.name || "Unknown",
        ctasLevel: patient.finalCTAS || patient.aiCTAS || "--",
        deviceId: patient.deviceInfo?.deviceId || "D1",
        alerts: alertItems,
        vitals: data,
        resolved: false,
        createdAt: new Date().toISOString(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  }
}

document.getElementById("detailsModal")
.addEventListener("click", function (e) {
  if (e.target === this) closeDetailsModal();
});

document.getElementById("stopModal")
.addEventListener("click", function (e) {
  if (e.target === this) {
    document.getElementById("stopModal").classList.remove("open");
    document.getElementById("detailsModal").classList.add("open");
  }
});