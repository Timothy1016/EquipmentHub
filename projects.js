(async function () {
  const session = EHAuth.requireAuth();
  if (!session) return;

  const root = document.getElementById("projectsRoot");

  async function render() {
    const projects = (await EHDB.getAll("projects"))
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));

    root.innerHTML = `
      <div class="projects-page">
        <header class="projects-header">
          <div class="projects-brand">
            <span class="projects-logo">E</span>
            <strong>EquipmentHub</strong>
          </div>

          <div class="projects-header-actions">
            <button class="theme-toggle" data-theme-toggle type="button"></button>
            <span class="projects-user">${EH.safe(session.name)}</span>
            <button class="header-text-button" id="logoutButton">Sign out</button>
          </div>
        </header>

        <main class="projects-container">
          <div class="projects-title-row">
            <div>
              <span class="projects-eyebrow">PROJECTS</span>
              <h1>Your projects</h1>
            </div>
            <button class="btn primary" id="newProjectTop">+ New project</button>
          </div>

          <section class="project-list">
            ${projects.length ? projects.map(project => `
              <article class="project-row">
                <button class="project-open" data-open="${project.id}">
                  <span class="project-icon">E</span>
                  <span class="project-info">
                    <strong>${EH.safe(project.name)}</strong>
                    <small>${EH.safe(project.primaryLocation || "No primary location")}</small>
                  </span>
                  <span class="project-updated">${relative(project.updatedAt || project.createdAt)}</span>
                  <span class="project-arrow">→</span>
                </button>
                <button class="project-menu-button" data-delete="${project.id}" title="Delete project">•••</button>
              </article>
            `).join("") : `
              <div class="projects-empty">
                <strong>No projects yet.</strong>
                <span>Create a new project or open a backup.</span>
              </div>
            `}
          </section>

          <section class="projects-actions">
            <button class="project-action-card" id="newProject">
              <span class="project-action-icon">+</span>
              <span><strong>New project</strong><small>Create a fresh equipment workspace</small></span>
              <b>→</b>
            </button>

            <label class="project-action-card" for="openBackup">
              <span class="project-action-icon">↑</span>
              <span><strong>Open backup</strong><small>Import an EquipmentHub JSON file</small></span>
              <b>→</b>
              <input class="hidden" id="openBackup" type="file" accept=".json,application/json">
            </label>
          </section>
        </main>
      </div>
    `;

    EHTheme.refresh();
    document.getElementById("logoutButton").onclick = EHAuth.signOut;
    document.getElementById("newProjectTop").onclick = openNewProject;
    document.getElementById("newProject").onclick = openNewProject;

    root.querySelectorAll("[data-open]").forEach(button => {
      button.onclick = () => {
        localStorage.setItem("equipmentHub.currentProjectId", button.dataset.open);
        location.href = "dashboard.html";
      };
    });

    root.querySelectorAll("[data-delete]").forEach(button => {
      button.onclick = async () => {
        const project = projects.find(p => p.id === button.dataset.delete);
        if (!project) return;
        if (!confirm(`Delete "${project.name}" and all of its local data?`)) return;
        await EHDB.deleteProject(project.id);
        if (localStorage.getItem("equipmentHub.currentProjectId") === project.id) {
          localStorage.removeItem("equipmentHub.currentProjectId");
        }
        render();
      };
    });

    document.getElementById("openBackup").onchange = async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const project = await EHDB.importProject(payload, EH.uid);
        localStorage.setItem("equipmentHub.currentProjectId", project.id);
        location.href = "dashboard.html";
      } catch (error) {
        console.error(error);
        EH.toast("Invalid EquipmentHub backup.");
        event.target.value = "";
      }
    };
  }

  function openNewProject() {
    EH.openModal(`
      <form id="newProjectForm">
        <div class="modal-head">
          <strong>New project</strong>
          <button type="button" class="icon-button" id="closeProject">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full">
              <label>Project name *</label>
              <input class="input" name="name" required autofocus placeholder="Nanjing Multimedia Equipment">
            </div>
            <div class="field">
              <label>Primary location</label>
              <input class="input" name="location" placeholder="Main Warehouse">
            </div>
            <div class="field">
              <label>Description</label>
              <input class="input" name="description" placeholder="Optional">
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn ghost" id="cancelProject">Cancel</button>
          <button class="btn primary">Create project</button>
        </div>
      </form>
    `);

    document.getElementById("closeProject").onclick =
      document.getElementById("cancelProject").onclick = EH.closeModal;

    document.getElementById("newProjectForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const project = {
        id: EH.uid("PRJ"),
        name: String(form.get("name") || "").trim(),
        primaryLocation: String(form.get("location") || "").trim(),
        description: String(form.get("description") || "").trim(),
        createdAt: EH.now(),
        updatedAt: EH.now()
      };
      await EHDB.put("projects", project);
      await EH.seedDefaults(project.id);

      if (project.primaryLocation) {
        const locations = await EHDB.listForProject("locations", project.id);
        const main = locations[0];
        if (main) {
          main.name = project.primaryLocation;
          await EHDB.put("locations", main);
        }
      }

      localStorage.setItem("equipmentHub.currentProjectId", project.id);
      location.href = "dashboard.html";
    };
  }

  function relative(value) {
    if (!value) return "";
    const diff = Date.now() - new Date(value).getTime();
    const days = Math.floor(diff / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  render();
})();
