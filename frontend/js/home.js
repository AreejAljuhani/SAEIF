document.addEventListener("DOMContentLoaded", () => {
  console.log("Saeif Real-Time Dashboard connected to Firestore ✔️");

  // If patient documents update frequently (e.g., IoT vitals), Firestore snapshots can fire very often.
  // Throttle ONLY the waiting-time UI so it doesn't look like it's updating “every second”.
  const WAITING_TIME_UI_UPDATE_MS = 60000; // 1 minute
  let lastWaitingTimeUiUpdateAt = 0;
  let lastWaitingTimeUiValue = null;

  if (typeof db === "undefined") {
    console.error("❌ Firestore db is not defined. Make sure firebase-config.js is loaded.");
    return;
  }

  const patientsRef = db.collection("patients");

  // Helper function to update elements
  function setNumber(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // Clicking on cards for navigation
  document.querySelectorAll(".stat-action").forEach(action => {
    action.addEventListener("click", () => {
      const target = action.dataset.action;
      if (target === "patient-list") location.href = "patient-list.html";
      if (target === "iot-monitoring") location.href = "iot-monitoring.html";
      if (target === "alerts") location.href = "alerts.html";
    });
  });

  // Real-time listener on Firestore 
  patientsRef.onSnapshot(snapshot => {
    const now = new Date();

    let totalPatients = 0;
    let underObservation = 0;
    let alertsCount = 0;

    const ctasCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    let waitingTotalMinutes = 0;
    let waitingCount = 0;

    snapshot.forEach(doc => {
      totalPatients++;
      const data = doc.data();

      const finalCTAS =
        typeof data.finalCTAS === "number"
          ? data.finalCTAS
          : data.aiCTAS || null;

      const status = data.status || "waiting";
      const createdAt = data.createdAt ? new Date(data.createdAt) : null;

      // Count CTAS categories
      if (finalCTAS >= 1 && finalCTAS <= 5) {
        ctasCounts[finalCTAS]++;
      }

      // Under observation = under treatment
      if (status === "under-treatment") underObservation++;

      // Alerts = Critical (CTAS 1)
      if (finalCTAS === 1) alertsCount++;

      // Average waiting time calculation
      if (status === "waiting" && createdAt instanceof Date && !isNaN(createdAt)) {
          const diffMs = now - createdAt;
          const diffMinutes = diffMs / 60000;
      if (diffMinutes >= 0 && diffMinutes < 1440) {
        waitingTotalMinutes += diffMinutes;
        waitingCount++;
    }
}
    });

    // Update dashboard UI ✨
    setNumber("totalPatients", totalPatients);
    setNumber("underObservation", underObservation);
    setNumber("alertsCount", alertsCount);

    setNumber("ctas1Count", ctasCounts[1]);
    setNumber("ctas2Count", ctasCounts[2]);
    setNumber("ctas3Count", ctasCounts[3]);
    setNumber("ctas4Count", ctasCounts[4]);
    setNumber("ctas5Count", ctasCounts[5]);

    const avgMinutes =
      waitingCount > 0 ? Math.round(waitingTotalMinutes / waitingCount) : 0;
    const waitingEl = document.getElementById("avgWaitingTime");
    if (waitingEl) {
      const nowMs = Date.now();
      const due = (nowMs - lastWaitingTimeUiUpdateAt) >= WAITING_TIME_UI_UPDATE_MS;
      const changed = avgMinutes !== lastWaitingTimeUiValue;

      if (due && changed) {
        waitingEl.innerHTML = `${avgMinutes}<span> minutes</span>`;
        lastWaitingTimeUiUpdateAt = nowMs;
        lastWaitingTimeUiValue = avgMinutes;
      }
    }
  });
});