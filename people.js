(async function () {
  const project = await EH.shell("people", "People", "Manage people who can hold or be responsible for equipment.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");

  async function render() {
    const people = await EHDB.listForProject("people", projectId);
    root.innerHTML = `
      <div class="toolbar toolbar-end"><button class="btn primary" id="addPerson">+ Add person</button></div>
      <div class="grid grid-3">
        ${people.length ? people.map(p => `
          <div class="card">
            <h3>${EH.safe(p.name)}</h3>
            <div class="subtle">${EH.safe(p.role || "Team member")}</div>
            <p class="subtle">${EH.safe(p.contact || "")}</p>
            <div class="row-actions"><button class="btn" data-edit="${p.id}">Edit</button><button class="btn danger" data-delete="${p.id}">Delete</button></div>
          </div>
        `).join("") : `<div class="card empty">No people yet.</div>`}
      </div>
    `;

    document.getElementById("addPerson").onclick = () => openForm();
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openForm(people.find(p => p.id === b.dataset.edit)));
    root.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this person?")) return;
      await EHDB.remove("people", b.dataset.delete);
      render();
    });
  }

  function openForm(person = null) {
    EH.openModal(`
      <form id="personForm">
        <div class="modal-head"><strong>${person ? "Edit" : "Add"} person</strong><button type="button" class="icon-button" id="closePerson">×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label>Name *</label><input class="input" name="name" required value="${EH.safe(person?.name || "")}"></div>
            <div class="field"><label>Role</label><input class="input" name="role" value="${EH.safe(person?.role || "")}"></div>
            <div class="field"><label>Contact</label><input class="input" name="contact" value="${EH.safe(person?.contact || "")}"></div>
            <div class="field full"><label>Notes</label><textarea name="notes">${EH.safe(person?.notes || "")}</textarea></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelPerson">Cancel</button><button class="btn primary">Save</button></div>
      </form>
    `);

    document.getElementById("closePerson").onclick =
      document.getElementById("cancelPerson").onclick = EH.closeModal;

    document.getElementById("personForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      await EHDB.put("people", {
        id: person?.id || EH.uid("PER"),
        projectId,
        name: String(form.get("name") || "").trim(),
        role: String(form.get("role") || "").trim(),
        contact: String(form.get("contact") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        createdAt: person?.createdAt || EH.now(),
        updatedAt: EH.now()
      });
      EH.closeModal();
      render();
    };
  }

  render();
})();
