// Landing menu: shown first on every load; "Ordering" opens the existing
// branch picker. app.js is not modified.
(function () {
  document.getElementById("openOrdering").addEventListener("click", function () {
    showScreen("branchScreen");
  });
  document.getElementById("backToLauncher").addEventListener("click", function () {
    showScreen("launcherScreen");
  });

  // Theme toggle on the landing screen (app.js owns the one on the branch screen)
  var btn = document.getElementById("launcherThemeToggle");
  function sync() {
    var light = document.documentElement.getAttribute("data-theme") === "light";
    btn.textContent = light ? "\u263D" : "\u2600";
    var next = light ? "dark" : "light";
    btn.title = "Switch to " + next + " mode";
    btn.setAttribute("aria-label", "Switch to " + next + " mode");
  }
  btn.addEventListener("click", toggleTheme);
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  sync();

  showScreen("launcherScreen");
})();
