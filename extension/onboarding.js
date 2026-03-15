document.getElementById("continueBtn").addEventListener("click", () => {
  const approved = {};
  document.querySelectorAll(".toggle-input").forEach((t) => {
    approved[t.dataset.site] = t.checked;
  });

  chrome.storage.local.set(
    {
      onboardingComplete: true,
      approvedSites: approved,
      scanning: true,
    },
    () => {
      window.close();
    },
  );
});
