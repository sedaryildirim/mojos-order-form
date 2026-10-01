// Moves keyboard and screen-reader focus to the new screen's heading when
// app.js switches screens (visual and behavioural logic stay in app.js).
(function () {
  var screens = document.querySelectorAll(".screen");
  var ready = false;
  setTimeout(function () { ready = true; }, 0); // ignore the initial render

  screens.forEach(function (screen) {
    new MutationObserver(function () {
      if (!ready || !screen.classList.contains("active")) return;
      var target = screen.querySelector("h1, h2, .topbar-title");
      if (!target) return;
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }).observe(screen, { attributes: true, attributeFilter: ["class"] });
  });
})();
