(async function () {
  const project = await EH.shell("locations", "Locations", "Manage warehouses, rooms and onsite storage locations.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");
  await EH.seedDefaults(projectId);

  async function render() {
    const rows = await EHDB.listForProject("locations", projectId);
    root.innerHTML = `
      <div class="toolbar toolbar-end"><button class="btn primary" id="addLocation">+ Add location</button></div>
      <div class="grid grid-3">
        ${rows.length ? rows.map(row => `
          <div class="card">
            <h3>${EH.safe(row.name)}</h3>
            <p class="subtle">${EH.safe(row.notes || "")}</p>
            <div class="row-actions"><button class="btn" data-edit="${row.id}">Edit</button><button class="btn danger" data-delete="${row.id}">Delete</button></div>
          </div>
        `).join("") : `<div class="card empty">No locations yet.</div>`}
      </div>
    `;

    document.getElementById("addLocation").onclick = () => openForm();
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openForm(rows.find(x => x.id === b.dataset.edit)));
    root.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this location?")) return;
      await EHDB.remove("locations", b.dataset.delete);
      render();
    });
  }

  function openForm(location = null) {
    EH.openModal(`
      <form id="locationForm">
        <div class="modal-head"><strong>${location ? "Edit" : "Add"} location</strong><button type="button" class="icon-button" id="closeLocation">×</button></div>
        <div class="modal-body">
          <div class="field"><label>Name *</label><input class="input" name="name" required value="${EH.safe(location?.name || "")}"></div>
          <div class="field field-gap"><label>Notes</label><textarea name="notes">${EH.safe(location?.notes || "")}</textarea></div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelLocation">Cancel</button><button class="btn primary">Save</button></div>
      </form>
    `);

    document.getElementById("closeLocation").onclick =
      document.getElementById("cancelLocation").onclick = EH.closeModal;

    document.getElementById("locationForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      await EHDB.put("locations", {
        id: location?.id || EH.uid("LOC"),
        projectId,
        name: String(form.get("name") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        createdAt: location?.createdAt || EH.now(),
        updatedAt: EH.now()
      });
      EH.closeModal();
      render();
    };
  }

  render();
})();
