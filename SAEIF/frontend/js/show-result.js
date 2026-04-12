document.addEventListener("DOMContentLoaded", () => {
  const confirmBtn = document.querySelector(".btn.primary");

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      // no backend yet, so just feedback
      alert("Result confirmed successfully.");
      // later: call backend to save result
    });
  }
});
