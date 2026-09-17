(function () {
  const KEY = "equipmentHub.theme";

  function preferred() {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
    return "dark";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(KEY, theme);
    refresh();
  }

  function icon(theme) {
    return theme === "dark"
      ? `<svg viewBox="0 0 24 24" aria-hidden="true">
           <circle cx="12" cy="12" r="4"></circle>
           <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
         </svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z"></path>
         </svg>`;
  }

  function refresh() {
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.innerHTML = icon(theme);
      button.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
      button.setAttribute("aria-label", button.title);
    });
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-theme-toggle]");
    if (!button) return;
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    apply(current === "dark" ? "light" : "dark");
  });

  document.addEventListener("DOMContentLoaded", refresh);

  apply(preferred());

  window.EHTheme = { apply, refresh };
})();
