document.addEventListener("DOMContentLoaded", () => {
  const levelButtons = document.querySelectorAll(".ctas-box");
  const confirmBtn = document.querySelector(".btn.primary");

  const patientData = JSON.parse(sessionStorage.getItem("patientData") || "{}");
  const triageResult = JSON.parse(sessionStorage.getItem("triageResult") || "{}");
  const patientId = sessionStorage.getItem("patientId");

  const nameEl = document.querySelector(".patient-name");
  const metaEls = document.querySelectorAll(".meta");
  const chiefEl = document.querySelector(".chief-text");
  const currentCtasEl = document.querySelector(".ctas-pill");

  if (nameEl) {
    nameEl.textContent = patientData.personalInfo?.name || "Unknown patient";
  }

  if (metaEls[0]) {
    const age = patientData.personalInfo?.age || "-";
    const sex = patientData.personalInfo?.sex || "-";
    metaEls[0].textContent = `${age} years old • ${sex}`;
  }

  if (metaEls[1]) {
    metaEls[1].textContent = `Patient ID: ${patientId || "-"}`;
  }

  if (chiefEl) {
    chiefEl.textContent =
      patientData.chiefComplaint?.chief_complain || "No chief complaint provided";
  }

  const currentLevel =
    triageResult.aiCTAS ??
    (typeof triageResult.prediction === "number"
      ? triageResult.prediction
      : triageResult.prediction?.prediction);

  if (currentCtasEl && currentLevel) {
    currentCtasEl.textContent = `CTAS - ${currentLevel}`;

    const pillClasses = ["level-1", "level-2", "level-3", "level-4", "level-5"];

    function setCtasPill(level) {
      if (!currentCtasEl) return;


      pillClasses.forEach(c => currentCtasEl.classList.remove(c));


      currentCtasEl.classList.add(`level-${level}`);
    }

    if (currentCtasEl && currentLevel) {
      const lvl = Number(currentLevel);
      currentCtasEl.textContent = `CTAS - ${lvl}`;
      setCtasPill(lvl);
    }
  }

  const levelColors = {
    1: "#FF3B30",
    2: "#FF9F0A",
    3: "#FFD60A",
    4: "#34C759",
    5: "#5856D6"
  };

  function selectLevel(btn) {
    levelButtons.forEach(b => {
      b.classList.remove("selected");
      const lvl = b.dataset.level;
      b.style.background = "#fff";
      b.style.color = levelColors[lvl];
      b.style.borderColor = levelColors[lvl];
      b.style.boxShadow = "none";
    });

    const level = btn.dataset.level;
    btn.classList.add("selected");
    btn.style.background = levelColors[level];
    btn.style.color = "#fff";
    btn.style.borderColor = levelColors[level];
    btn.style.boxShadow = `0 8px 18px ${levelColors[level]}40`;
  }

  const defaultSelected = document.querySelector(".ctas-box.selected");
  if (defaultSelected) {
    selectLevel(defaultSelected);
  }

  levelButtons.forEach(btn => {
    btn.addEventListener("click", () => selectLevel(btn));
  });

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      const chosen = document.querySelector(".ctas-box.selected");
      const chosenLevel = chosen ? Number(chosen.dataset.level) : null;
      const textareas = document.querySelectorAll("textarea");
      const reason = textareas[0] ? textareas[0].value : "";
      const notes = textareas[1] ? textareas[1].value : "";

      if (!chosenLevel) {
        alert("Please select a CTAS level first.");
        return;
      }

      if (!patientId) {
        alert("Missing patient ID. Please re-open classification.");
        return;
      }

      try {
        const now = new Date().toISOString();

        await db.collection("patients").doc(patientId).update({
          finalCTAS: chosenLevel,
          overrideReason: reason,
          reclassificationNotes: notes,
          status: "under-treatment",
          updatedAt: now
        });

        sessionStorage.setItem(
          "triageResult",
          JSON.stringify({ ...triageResult, finalCTAS: chosenLevel })
        );

        alert(`Reclassification confirmed to CTAS-${chosenLevel}.`);
        window.location.href = "patient-list.html";
      } catch (err) {
        console.error("Reclassification error:", err);
        alert("Failed to save reclassification.");
      }
    });
  }
});
