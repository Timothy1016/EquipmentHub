(async function () {
  const project = await EH.shell("maintenance", "Maintenance", "Track repairs, inspections and equipment issues.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");

  async function render() {
    const [records, items] = await Promise.all([
      EHDB.listForProject("maintenance", projectId),
      EHDB.listForProject("items", projectId)
    ]);

    root.innerHTML = `
      <div class="toolbar toolbar-end"><button class="btn primary" id="addMaintenance">+ Add maintenance</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Issue</th><th>Status</th><th>Assigned</th><th>Opened</th><th>Actions</th></tr></thead>
          <tbody>
            ${records.length ? records.map(record => `
              <tr>
                <td>${EH.safe(record.itemName || items.find(i => i.id === record.itemId)?.name || "-")}</td>
                <td>${EH.safe(record.issue || "-")}</td>
                <td>${EH.badge(record.status || "Pending")}</td>
                <td>${EH.safe(record.assignedTo || "-")}</td>
                <td>${EH.fmtDate(record.createdAt)}</td>
                <td><div class="row-actions"><button class="btn" data-edit="${record.id}">Edit</button><button class="btn danger" data-delete="${record.id}">Delete</button></div></td>
              </tr>
            `).join("") : `<tr><td colspan="6"><div class="empty">No maintenance records.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("addMaintenance").onclick = () => openForm(null, items);
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openForm(records.find(r => r.id === b.dataset.edit), items));
    root.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this maintenance record?")) return;
      await EHDB.remove("maintenance", b.dataset.delete);
      render();
    });
  }

  function openForm(record, items) {
    EH.openModal(`
      <form id="maintenanceForm">
        <div class="modal-head"><strong>${record ? "Edit" : "Add"} maintenance</strong><button type="button" class="icon-button" id="closeMaintenance">×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label>Equipment</label><select name="itemId"><option value="">-</option>${items.map(i => `<option value="${i.id}" ${i.id === record?.itemId ? "selected" : ""}>${EH.safe(i.name)}</option>`).join("")}</select></div>
            <div class="field full"><label>Issue *</label><input class="input" name="issue" required value="${EH.safe(record?.issue || "")}"></div>
            <div class="field"><label>Status</label><select name="status">${["Pending", "In Repair", "Resolved", "Unrepairable"].map(v => `<option ${record?.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
            <div class="field"><label>Assigned to</label><input class="input" name="assignedTo" value="${EH.safe(record?.assignedTo || "")}"></div>
            <div class="field full"><label>Notes</label><textarea name="notes">${EH.safe(record?.notes || "")}</textarea></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelMaintenance">Cancel</button><button class="btn primary">Save</button></div>
      </form>
    `);

    document.getElementById("closeMaintenance").onclick =
      document.getElementById("cancelMaintenance").onclick = EH.closeModal;

    document.getElementById("maintenanceForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const item = items.find(i => i.id === form.get("itemId"));
      await EHDB.put("maintenance", {
        id: record?.id || EH.uid("MNT"),
        projectId,
        itemId: form.get("itemId"),
        itemName: item?.name || "",
        issue: String(form.get("issue") || "").trim(),
        status: form.get("status"),
        assignedTo: String(form.get("assignedTo") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        createdAt: record?.createdAt || EH.now(),
        updatedAt: EH.now()
      });
      EH.closeModal();
      render();
    };
  }

  render();
})();
