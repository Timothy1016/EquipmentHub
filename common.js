(function () {
  const pages = [
    ["dashboard", "dashboard.html", "Dashboard", "⌂"],
    ["inventory", "inventory.html", "Inventory", "▦"],
    ["events", "events.html", "Events", "◫"],
    ["weekly", "weekly-check.html", "Weekly Check", "✓"],
    ["people", "people.html", "People", "♙"],
    ["locations", "locations.html", "Locations", "⌖"],
    ["maintenance", "maintenance.html", "Maintenance", "⚒"],
    ["activity", "activity.html", "Activity", "≋"],
    ["reports", "reports.html", "Reports / Backup", "⇩"]
  ];

  function safe(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  function uid(prefix = "ID") {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  function now() {
    return new Date().toISOString();
  }

  function fmtDate(value) {
    return value ? new Date(value).toLocaleString() : "-";
  }

  function getCurrentProjectId() {
    return localStorage.getItem("equipmentHub.currentProjectId");
  }

  async function requireProject() {
    EHAuth.requireAuth();
    const id = getCurrentProjectId();
    if (!id) {
      location.replace("projects.html");
      return null;
    }
    const project = await EHDB.get("projects", id);
    if (!project) {
      localStorage.removeItem("equipmentHub.currentProjectId");
      location.replace("projects.html");
      return null;
    }
    return project;
  }

  async function shell(active, title, subtitle = "") {
    const session = EHAuth.requireAuth();
    const project = await requireProject();
    if (!session || !project) return null;

    const nav = pages.map(([id, href, label, icon]) => `
      <a class="nav-link ${active === id ? "active" : ""}" href="${href}">
        <span class="nav-icon">${icon}</span>
        <span>${label}</span>
        ${active === id ? `<span class="nav-active-dot"></span>` : ""}
      </a>
    `).join("");

    document.body.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand-row">
            <a class="brand" href="projects.html">
              <span class="brand-mark">E</span>
              <span>EquipmentHub</span>
            </a>
          </div>

          <div class="workspace-card">
            <span class="workspace-label">PROJECT</span>
            <strong>${safe(project.name)}</strong>
            <a class="workspace-switch" href="projects.html">Switch project <span>→</span></a>
          </div>

          <div class="sidebar-label">OPERATIONS</div>
          <nav class="nav">${nav}</nav>

          <div class="sidebar-footer">
            <button class="shortcut-button" id="commandButton"><span>Search pages</span><kbd>⌘ K</kbd></button>
            <div class="sidebar-session">
              <span>${safe(session.name)}</span>
              <button id="logoutButton">Sign out</button>
            </div>
          </div>
        </aside>

        <main class="main">
          <header class="topbar">
            <div>
              <span class="page-eyebrow">${safe(project.name)}</span>
              <h1>${safe(title)}</h1>
              ${subtitle ? `<p class="page-subtitle">${safe(subtitle)}</p>` : ""}
            </div>

            <div class="topbar-actions">
              <button class="theme-toggle" data-theme-toggle type="button"></button>
              <button class="top-search" id="topSearch"><span>Search pages</span><kbd>⌘ K</kbd></button>
            </div>
          </header>

          <div id="pageRoot"></div>
        </main>
      </div>

      <div class="modal-backdrop" id="modalBackdrop"></div>
      <div class="command-backdrop" id="commandBackdrop">
        <div class="command-panel">
          <div class="command-search-row">
            <span>⌕</span>
            <input id="commandInput" placeholder="Search pages..." autocomplete="off">
            <kbd>ESC</kbd>
          </div>
          <div class="command-results" id="commandResults"></div>
        </div>
      </div>
      <div class="toast" id="toast"></div>
    `;

    document.getElementById("logoutButton").onclick = EHAuth.signOut;
    setupCommand();
    EHTheme.refresh();

    return project;
  }

  function setupCommand() {
    const backdrop = document.getElementById("commandBackdrop");
    const input = document.getElementById("commandInput");
    const results = document.getElementById("commandResults");

    const render = (q = "") => {
      const filtered = pages.filter(p => p[2].toLowerCase().includes(q.toLowerCase()));
      results.innerHTML = filtered.map(p => `
        <a class="command-item" href="${p[1]}">
          <span class="command-item-icon">${p[3]}</span>
          <span>${p[2]}</span>
          <span>→</span>
        </a>
      `).join("");
    };

    const open = () => {
      backdrop.classList.add("show");
      render();
      setTimeout(() => input.focus(), 10);
    };

    const close = () => {
      backdrop.classList.remove("show");
      input.value = "";
    };

    document.getElementById("commandButton").onclick = open;
    document.getElementById("topSearch").onclick = open;
    input.oninput = e => render(e.target.value);
    backdrop.onclick = e => { if (e.target === backdrop) close(); };

    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
      if (e.key === "Escape") close();
    });
  }

  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(window.__ehToast);
    window.__ehToast = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function openModal(html) {
    const bg = document.getElementById("modalBackdrop");
    bg.innerHTML = `<div class="modal">${html}</div>`;
    bg.classList.add("show");
    bg.onclick = e => { if (e.target === bg) closeModal(); };
  }

  function closeModal() {
    const bg = document.getElementById("modalBackdrop");
    if (!bg) return;
    bg.classList.remove("show");
    bg.innerHTML = "";
  }

  function statusClass(status) {
    if (["Available", "Completed", "Resolved", "Present", "Good"].includes(status)) return "ok";
    if (["Missing", "Overdue", "Damaged", "Unusable"].includes(status)) return "danger";
    if (["Maintenance", "Pending", "In Repair", "Low Stock"].includes(status)) return "warn";
    if (["On Site", "Reserved", "Packed", "With Person", "In Transit"].includes(status)) return "info";
    return "neutral";
  }

  function badge(status) {
    return `<span class="badge ${statusClass(status)}"><span class="badge-dot"></span>${safe(status || "-")}</span>`;
  }

  async function compressImage(file, max = 1200, quality = 0.78) {
    if (!file) return "";
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = data;
    });
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }

  async function addMovement(projectId, obj) {
    const session = EHAuth.getSession();
    await EHDB.put("movements", {
      id: uid("MOV"),
      projectId,
      createdAt: now(),
      operator: session?.name || "Local User",
      itemId: "",
      itemName: "",
      action: "",
      fromLocation: "",
      toLocation: "",
      fromPerson: "",
      toPerson: "",
      notes: "",
      ...obj
    });
  }

  async function seedDefaults(projectId) {
    const locations = await EHDB.listForProject("locations", projectId);
    if (locations.length) return;
    for (const name of ["Main Warehouse", "Equipment Room", "On Site", "With Team Member", "Maintenance"]) {
      await EHDB.put("locations", {
        id: uid("LOC"),
        projectId,
        name,
        notes: "",
        createdAt: now()
      });
    }
  }

  window.EH = {
    pages, safe, uid, now, fmtDate, shell, requireProject, getCurrentProjectId,
    toast, openModal, closeModal, badge, compressImage, addMovement, seedDefaults
  };
})();
