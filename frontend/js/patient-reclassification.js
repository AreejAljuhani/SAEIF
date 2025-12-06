document.addEventListener("DOMContentLoaded", () => {
  const levelButtons = document.querySelectorAll(".ctas-box");
  const confirmBtn = document.querySelector(".btn.primary");

  // map level -> color (matches your CSS figma colors)
  const levelColors = {
    1: "#FF3B30",
    2: "#FF9F0A",
    3: "#FFD60A",
    4: "#34C759",
    5: "#5856D6"
  };

  function selectLevel(btn) {
    // remove selected from all
    levelButtons.forEach(b => {
      b.classList.remove("selected");
      b.style.background = "#fff";
      b.style.color = levelColors[b.dataset.level];
      b.style.borderColor = levelColors[b.dataset.level];
      b.style.boxShadow = "none";
    });

    // add selected to clicked
    const level = btn.dataset.level;
    btn.classList.add("selected");
    btn.style.background = levelColors[level];
    btn.style.color = "#fff";
    btn.style.borderColor = levelColors[level];
    btn.style.boxShadow = `0 8px 18px ${levelColors[level]}40`;
  }

  // default selected (already in HTML)
  const defaultSelected = document.querySelector(".ctas-box.selected");
  if (defaultSelected) selectLevel(defaultSelected);

  // click handler
  levelButtons.forEach(btn => {
    btn.addEventListener("click", () => selectLevel(btn));
  });

  // confirm handler
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      const chosen = document.querySelector(".ctas-box.selected");
      const chosenLevel = chosen ? chosen.dataset.level : null;

      if (!chosenLevel) {
        alert("Please select a CTAS level first.");
        return;
      }

      // For now (no backend): just show confirmation
      alert(`Reclassification confirmed to CTAS-${chosenLevel}.`);
      // later you will send this to backend 
    });
  }
});
