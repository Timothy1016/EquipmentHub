(async function () {
  const project = await EH.shell("inventory", "Inventory", "Track equipment, status, location and custody.");
  if (!project) return;
  const projectId = project.id;
  await EH.seedDefaults(projectId);
  const root = document.getElementById("pageRoot");
  let search = "";

  async function render() {
    const [items, locations, people] = await Promise.all([
      EHDB.listForProject("items", projectId),
      EHDB.listForProject("locations", projectId),
      EHDB.listForProject("people", projectId)
    ]);

    const visible = items.filter(i => !i.archived).filter(i =>
      `${i.name || ""} ${i.category || ""} ${i.id || ""}`.toLowerCase().includes(search.toLowerCase())
    );

    root.innerHTML = `
      <div class="toolbar toolbar-between">
        <input class="input" id="inventorySearch" placeholder="Search equipment..." value="${EH.safe(search)}">
        <button class="btn primary" id="addItem">+ Add equipment</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Photo</th><th>Item</th><th>Category</th><th>Status</th><th>Condition</th><th>Location</th><th>Person</th><th>Qty</th><th>Actions</th></tr></thead>
          <tbody>
            ${visible.length ? visible.map(item => `
              <tr>
                <td>${item.photo ? `<img class="thumb" src="${item.photo}" alt="">` : `<div class="thumb placeholder">NO IMG</div>`}</td>
                <td><strong>${EH.safe(item.name)}</strong><div class="subtle">${EH.safe(item.id)}</div></td>
                <td>${EH.safe(item.category || "-")}</td>
                <td>${EH.badge(item.status || "Available")}</td>
                <td>${EH.badge(item.condition || "Good")}</td>
                <td>${EH.safe(locations.find(x => x.id === item.locationId)?.name || "-")}</td>
                <td>${EH.safe(people.find(x => x.id === item.personId)?.name || "-")}</td>
                <td>${item.type === "quantity" ? Number(item.quantity || 0) : "1"}</td>
                <td><div class="row-actions">
                  <button class="btn" data-edit="${item.id}">Edit</button>
                  <button class="btn" data-move="${item.id}">Move</button>
                  <button class="btn danger" data-delete="${item.id}">Delete</button>
                </div></td>
              </tr>
            `).join("") : `<tr><td colspan="9"><div class="empty">No equipment yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("inventorySearch").oninput = event => {
      search = event.target.value;
      render();
    };
    document.getElementById("addItem").onclick = () => openItem(null, locations, people);
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openItem(items.find(i => i.id === b.dataset.edit), locations, people));
    root.querySelectorAll("[data-move]").forEach(b => b.onclick = () => openMove(items.find(i => i.id === b.dataset.move), locations, people));
    root.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this equipment item?")) return;
      await EHDB.remove("items", b.dataset.delete);
      EH.toast("Item deleted.");
      render();
    });
  }

  function options(list, current) {
    return `<option value="">-</option>` + list.map(x => `<option value="${x.id}" ${x.id === current ? "selected" : ""}>${EH.safe(x.name)}</option>`).join("");
  }

  function openItem(item, locations, people) {
    EH.openModal(`
      <form id="itemForm">
        <div class="modal-head"><strong>${item ? "Edit equipment" : "Add equipment"}</strong><button type="button" class="icon-button" id="closeItem">×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label>Name *</label><input class="input" name="name" required value="${EH.safe(item?.name || "")}"></div>
            <div class="field"><label>Type</label><select name="type"><option value="serialized" ${item?.type !== "quantity" ? "selected" : ""}>Serialized</option><option value="quantity" ${item?.type === "quantity" ? "selected" : ""}>Quantity</option></select></div>
            <div class="field"><label>Category</label><input class="input" name="category" value="${EH.safe(item?.category || "")}"></div>
            <div class="field"><label>Status</label><select name="status">${["Available", "On Site", "With Person", "Maintenance", "Missing", "Reserved"].map(v => `<option ${item?.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
            <div class="field"><label>Condition</label><select name="condition">${["Good", "Fair", "Damaged", "Unusable"].map(v => `<option ${item?.condition === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
            <div class="field"><label>Location</label><select name="locationId">${options(locations, item?.locationId)}</select></div>
            <div class="field"><label>Responsible person</label><select name="personId">${options(people, item?.personId)}</select></div>
            <div class="field"><label>Quantity</label><input class="input" type="number" min="0" name="quantity" value="${item?.quantity ?? 1}"></div>
            <div class="field"><label>Minimum stock</label><input class="input" type="number" min="0" name="minStock" value="${item?.minStock ?? 0}"></div>
            <div class="field full"><label>Photo</label><input class="input" type="file" accept="image/*" name="photo"></div>
            <div class="field full"><label>Notes</label><textarea name="notes">${EH.safe(item?.notes || "")}</textarea></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelItem">Cancel</button><button class="btn primary">Save</button></div>
      </form>
    `);

    document.getElementById("closeItem").onclick =
      document.getElementById("cancelItem").onclick = EH.closeModal;

    document.getElementById("itemForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const file = event.target.photo.files[0];

      const record = {
        id: item?.id || EH.uid("ITM"),
        projectId,
        name: String(form.get("name") || "").trim(),
        type: form.get("type"),
        category: String(form.get("category") || "").trim(),
        status: form.get("status"),
        condition: form.get("condition"),
        locationId: form.get("locationId"),
        personId: form.get("personId"),
        quantity: Number(form.get("quantity") || 0),
        minStock: Number(form.get("minStock") || 0),
        notes: String(form.get("notes") || "").trim(),
        photo: item?.photo || "",
        archived: false,
        createdAt: item?.createdAt || EH.now(),
        updatedAt: EH.now()
      };

      if (file) record.photo = await EH.compressImage(file);
      await EHDB.put("items", record);

      if (!item) {
        await EH.addMovement(projectId, { itemId: record.id, itemName: record.name, action: "Created" });
      }

      await touchProject();
      EH.closeModal();
      EH.toast("Equipment saved.");
      render();
    };
  }

  function openMove(item, locations, people) {
    EH.openModal(`
      <form id="moveForm">
        <div class="modal-head"><strong>Move / assign · ${EH.safe(item.name)}</strong><button type="button" class="icon-button" id="closeMove">×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field"><label>Status</label><select name="status">${["Available", "On Site", "With Person", "Maintenance", "Missing", "Reserved"].map(v => `<option ${item.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
            <div class="field"><label>Location</label><select name="locationId">${options(locations, item.locationId)}</select></div>
            <div class="field full"><label>Responsible person</label><select name="personId">${options(people, item.personId)}</select></div>
            <div class="field full"><label>Notes</label><textarea name="notes"></textarea></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelMove">Cancel</button><button class="btn primary">Save movement</button></div>
      </form>
    `);

    document.getElementById("closeMove").onclick =
      document.getElementById("cancelMove").onclick = EH.closeModal;

    document.getElementById("moveForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const oldLocation = locations.find(x => x.id === item.locationId)?.name || "";
      const oldPerson = people.find(x => x.id === item.personId)?.name || "";

      item.status = form.get("status");
      item.locationId = form.get("locationId");
      item.personId = form.get("personId");
      item.updatedAt = EH.now();
      await EHDB.put("items", item);

      await EH.addMovement(projectId, {
        itemId: item.id,
        itemName: item.name,
        action: "Moved / status changed",
        fromLocation: oldLocation,
        toLocation: locations.find(x => x.id === item.locationId)?.name || "",
        fromPerson: oldPerson,
        toPerson: people.find(x => x.id === item.personId)?.name || "",
        notes: String(form.get("notes") || "")
      });

      await touchProject();
      EH.closeModal();
      EH.toast("Movement saved.");
      render();
    };
  }

  async function touchProject() {
    project.updatedAt = EH.now();
    await EHDB.put("projects", project);
  }

  render();
})();
