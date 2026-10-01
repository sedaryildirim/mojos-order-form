// Landing menu: shown first on every load; "Ordering" opens the existing
// branch picker. js/ordering/app.js is not modified.
(function () {
  document.getElementById("openOrdering").addEventListener("click", function () {
    showScreen("branchScreen");
  });
  document.getElementById("backToLauncher").addEventListener("click", function () {
    showScreen("launcherScreen");
  });

  // Kaif GP Calculator: selectable once config.tools.kaifGp.url is set (otherwise stays greyed out)
  var gp = CONFIG.tools && CONFIG.tools.kaifGp && CONFIG.tools.kaifGp.url;
  var gpCard = document.getElementById("openKaifGp");
  if (gp && gpCard) {
    var link = document.createElement("a");
    link.className = "launch-card";
    link.id = "openKaifGp";
    link.href = gp;
    link.innerHTML =
      '<span class="launch-kicker">Calculator</span>' +
      '<span class="launch-title">Kaif GP Calculator</span>' +
      '<span class="launch-desc">Dish costs and gross profit</span>' +
      '<span class="launch-badge">Work in progress</span>';
    gpCard.replaceWith(link);
  }

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
