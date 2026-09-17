(async function () {
  const project = await EH.shell("reports", "Reports / Backup", "Export or restore this project.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");

  root.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <span class="mini-label">BACKUP</span>
        <h2>Project backup</h2>
        <p class="subtle">Export a portable JSON copy of this project, including reminders.</p>
        <div class="toolbar">
          <button class="btn primary" id="exportBackup">Export JSON backup</button>
          <button class="btn" id="exportCsv">Export inventory CSV</button>
        </div>
      </div>

      <div class="card">
        <span class="mini-label">PROJECT</span>
        <h2>${EH.safe(project.name)}</h2>
        <p class="subtle">${EH.safe(project.primaryLocation || "No primary location")}</p>
        <a class="btn ghost" href="projects.html">← Back to projects</a>
      </div>
    </div>
  `;

  document.getElementById("exportBackup").onclick = async () => {
    const payload = await EHDB.exportProject(projectId);
    download(JSON.stringify(payload, null, 2), `${slug(project.name)}-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    EH.toast("Backup exported.");
  };

  document.getElementById("exportCsv").onclick = async () => {
    const [items, locations, people] = await Promise.all([
      EHDB.listForProject("items", projectId),
      EHDB.listForProject("locations", projectId),
      EHDB.listForProject("people", projectId)
    ]);

    const rows = [
      ["id", "name", "type", "category", "status", "condition", "location", "responsible", "quantity", "minStock"],
      ...items.map(i => [
        i.id, i.name, i.type, i.category, i.status, i.condition,
        locations.find(x => x.id === i.locationId)?.name || "",
        people.find(x => x.id === i.personId)?.name || "",
        i.quantity, i.minStock
      ])
    ];

    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    download(csv, `${slug(project.name)}-inventory.csv`, "text/csv");
  };

  function slug(value) {
    return String(value || "equipmenthub").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "equipmenthub";
  }

  function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
})();
