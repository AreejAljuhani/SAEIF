const alertsList = document.getElementById("alertsList");
const emptyAlerts = document.getElementById("emptyAlerts");
const unresolvedBadge = document.getElementById("unresolvedBadge");

db.collection("alerts")
  .orderBy("timestamp", "desc")
  .limit(50)
  .onSnapshot(snapshot => {

    alertsList.innerHTML = "";
    let unresolvedCount = 0;

    if (snapshot.size === 0) {
      emptyAlerts.style.display = "flex";
      unresolvedBadge.style.display = "none";
      return;
    }

    emptyAlerts.style.display = "none";

    snapshot.forEach(doc => {
      const alert = doc.data();
      const alertId = doc.id;

      if (!alert.resolved) unresolvedCount++;

      renderAlertCard(alertId, alert);
    });

    if (unresolvedCount > 0) {
      unresolvedBadge.textContent = unresolvedCount + " unresolved";
      unresolvedBadge.style.display = "inline-flex";
    } else {
      unresolvedBadge.style.display = "none";
    }

  }, error => {
    console.error("Error loading alerts:", error);
  });

function renderAlertCard(alertId, alert) {

  const card = document.createElement("div");
  card.className = "alert-card" + (alert.resolved ? " resolved" : "");

  const ctasLevel = alert.ctasLevel || "–";
  const name = alert.patientName || "Unknown";
  const deviceId = alert.deviceId || "D1";
  const vitals = alert.vitals || {};

  const time = alert.createdAt
    ? new Date(alert.createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : "–";

  const isHrAlert = vitals.heartRate > 120;
  const isSpo2Alert = vitals.spo2 < 92;
  const isTempAlert = vitals.temperature > 38;

  const detItems = [];

  if (isSpo2Alert)
    detItems.push({ dot: "dot-red", text: `SpO₂ dropped to ${vitals.spo2}%` });

  if (isHrAlert)
    detItems.push({ dot: "dot-yellow", text: `Heart rate elevated to ${vitals.heartRate} bpm` });

  if (ctasLevel === 3 || ctasLevel === "3") {
    detItems.push({ dot: "dot-yellow", text: "CTAS upgrade 3 → 2 recommended" });
  }

  const detHTML = detItems.map(item =>
    `<div class="deterioration-item">
      <span class="deterioration-dot ${item.dot}"></span>
      ${item.text}
    </div>`
  ).join("");

  card.innerHTML = `
    <div class="alert-card-top">
      <div class="alert-icon-wrap">
        <i class="fas fa-${alert.resolved ? "check" : "exclamation-triangle"}"></i>
      </div>

      <div class="alert-card-info">
        <div class="alert-card-title">Deterioration Alert — ${name}</div>

        <div class="alert-card-sub">
          <span><i class="fas fa-tag"></i> CTAS ${ctasLevel}</span>
          <span><i class="fas fa-watch"></i> ${deviceId}</span>
        </div>
      </div>

      <div class="alert-card-time">${time}</div>
    </div>

    <div class="alert-vitals">
      <div class="alert-vital-chip ${isHrAlert ? "abnormal" : ""}">
        <div class="alert-vital-chip-label">HR</div>
        <div class="alert-vital-chip-value">${vitals.heartRate || "--"}</div>
      </div>

      <div class="alert-vital-chip ${isSpo2Alert ? "abnormal" : ""}">
        <div class="alert-vital-chip-label">SpO2</div>
        <div class="alert-vital-chip-value">${vitals.spo2 || "--"}%</div>
      </div>

      <div class="alert-vital-chip ${isTempAlert ? "abnormal" : ""}">
        <div class="alert-vital-chip-label">Temp</div>
        <div class="alert-vital-chip-value">${vitals.temperature || "--"}°</div>
      </div>
    </div>

    ${detItems.length > 0 ? `
      <div class="deterioration-box">
        <div class="deterioration-box-header">
          <i class="fas fa-chart-line"></i> System Detected Deterioration
        </div>
        ${detHTML}
      </div>
    ` : ""}

    <div class="nurse-section-label">Nurse Decision — Update CTAS Level</div>

    <div class="nurse-actions" id="actions-${alertId}">
      ${buildActionButtons(alertId, alert)}
    </div>
  `;

  alertsList.appendChild(card);
}

function buildActionButtons(alertId, alert) {

  if (alert.resolved) {
    return `<span class="resolved-badge">
      <i class="fas fa-check-circle"></i> Resolved
    </span>`;
  }

  const ctasLevel = Number(alert.ctasLevel);
  let html = "";

  html += `<button class="btn-keep-level" onclick="handleKeepLevel('${alertId}')">
    Keep Level ${ctasLevel || ""}
  </button>`;

  if (ctasLevel === 3) {
    html += `<button class="btn-upgrade" onclick="handleUpgrade('${alertId}', '${alert.patientId}', 2)">
      Upgrade to 2
    </button>`;
  } else if (ctasLevel === 2) {
    html += `<button class="btn-upgrade" onclick="handleUpgrade('${alertId}', '${alert.patientId}', 1)">
      Upgrade to 1
    </button>`;
  }

  html += `<button class="btn-acknowledge" onclick="handleAcknowledge('${alertId}')">
    Acknowledge
  </button>`;

  html += `<button class="btn-continue" onclick="handleContinue('${alertId}')">
    Continue Monitoring
  </button>`;

  return html;
}

function handleKeepLevel(alertId) {
  resolveAlert(alertId, "kept_level");
}

function handleAcknowledge(alertId) {
  resolveAlert(alertId, "acknowledged");
}

function handleContinue(alertId) {
  resolveAlert(alertId, "continue_monitoring");
}

function handleUpgrade(alertId, patientId, targetLevel) {

  db.collection("patients").doc(patientId).get()
    .then(doc => {

      if (!doc.exists) {
        alert("Patient not found");
        return;
      }

      const patient = doc.data();

      sessionStorage.setItem("patientId", patientId);

      sessionStorage.setItem("patientData", JSON.stringify({
        personalInfo: {
          name: patient.name,
          age: patient.age,
          sex: patient.sex
        },
        chiefComplaint: {
          chief_complain: patient.chiefComplaint || ""
        }
      }));

      sessionStorage.setItem("triageResult", JSON.stringify({
        aiCTAS: patient.finalCTAS || patient.aiCTAS,
        finalCTAS: patient.finalCTAS || patient.aiCTAS
      }));

      sessionStorage.setItem("upgradeTargetLevel", String(targetLevel));

      resolveAlert(alertId, "upgraded");
      window.location.href = "patient-reclassification.html";

    })
    .catch(err => {
      console.error("Error fetching patient:", err);
      alert("Failed to load patient data");
    });
}

function resolveAlert(alertId, resolution) {

  db.collection("alerts").doc(alertId).update({
    resolved: true,
    resolution: resolution,
    resolvedAt: new Date().toISOString()
  })
  .then(() => {
    console.log("Alert resolved:", alertId, resolution);
  })
  .catch(err => {
    console.error("Error resolving alert:", err);
  });
}