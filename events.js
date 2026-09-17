(async function () {
  const project = await EH.shell("events", "Events", "Prepare onsite equipment and track packing readiness.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");

  async function render() {
    const [events, items, eventItems] = await Promise.all([
      EHDB.listForProject("events", projectId),
      EHDB.listForProject("items", projectId),
      EHDB.listForProject("eventItems", projectId)
    ]);

    const activeItems = items.filter(i => !i.archived);

    root.innerHTML = `
      <div class="toolbar toolbar-end"><button class="btn primary" id="addEvent">+ Create event</button></div>

      <div class="grid grid-2">
        ${events.length ? events.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(event => {
          const lines = eventItems.filter(x => x.eventId === event.id);
          const packed = lines.filter(x => x.packed).length;
          const ready = lines.length ? Math.round(packed / lines.length * 100) : 0;
          return `
            <article class="card">
              <div class="card-head">
                <div><h3>${EH.safe(event.name)}</h3><div class="subtle">${EH.safe(event.date || "No date")} · ${EH.safe(event.venue || "No venue")}</div></div>
                ${EH.badge(event.status || "Planned")}
              </div>
              <div class="notice">${packed}/${lines.length} packed · ${ready}% ready</div>
              <div class="row-actions card-actions">
                <button class="btn" data-manage="${event.id}">Manage equipment</button>
                <button class="btn" data-edit="${event.id}">Edit</button>
                <button class="btn danger" data-delete="${event.id}">Delete</button>
              </div>
            </article>
          `;
        }).join("") : `<div class="card empty">No events yet.</div>`}
      </div>
    `;

    document.getElementById("addEvent").onclick = () => openEvent();
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEvent(events.find(e => e.id === b.dataset.edit)));
    root.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
      if (!confirm("Delete this event?")) return;
      const eventId = b.dataset.delete;
      for (const line of eventItems.filter(x => x.eventId === eventId)) await EHDB.remove("eventItems", line.id);
      await EHDB.remove("events", eventId);
      render();
    });
    root.querySelectorAll("[data-manage]").forEach(b => b.onclick = () => openManage(events.find(e => e.id === b.dataset.manage), activeItems, eventItems));
  }

  function openEvent(event = null) {
    EH.openModal(`
      <form id="eventForm">
        <div class="modal-head"><strong>${event ? "Edit" : "Create"} event</strong><button type="button" class="icon-button" id="closeEvent">×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label>Name *</label><input class="input" name="name" required value="${EH.safe(event?.name || "")}"></div>
            <div class="field"><label>Date</label><input class="input" type="date" name="date" value="${EH.safe(event?.date || "")}"></div>
            <div class="field"><label>Status</label><select name="status">${["Planned", "Packing", "On Site", "Completed"].map(v => `<option ${event?.status === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
            <div class="field full"><label>Venue</label><input class="input" name="venue" value="${EH.safe(event?.venue || "")}"></div>
            <div class="field full"><label>Notes</label><textarea name="notes">${EH.safe(event?.notes || "")}</textarea></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelEvent">Cancel</button><button class="btn primary">Save</button></div>
      </form>
    `);

    document.getElementById("closeEvent").onclick =
      document.getElementById("cancelEvent").onclick = EH.closeModal;

    document.getElementById("eventForm").onsubmit = async eventSubmit => {
      eventSubmit.preventDefault();
      const form = new FormData(eventSubmit.target);
      await EHDB.put("events", {
        id: event?.id || EH.uid("EVT"),
        projectId,
        name: String(form.get("name") || "").trim(),
        date: form.get("date"),
        status: form.get("status"),
        venue: String(form.get("venue") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        createdAt: event?.createdAt || EH.now(),
        updatedAt: EH.now()
      });
      EH.closeModal();
      render();
    };
  }

  function openManage(event, items, eventItems) {
    const current = eventItems.filter(x => x.eventId === event.id);

    EH.openModal(`
      <div class="modal-head"><strong>${EH.safe(event.name)} · Equipment</strong><button type="button" class="icon-button" id="closeManage">×</button></div>
      <div class="modal-body">
        <div class="stack-list">
          ${items.length ? items.map(item => {
            const line = current.find(x => x.itemId === item.id);
            return `
              <label class="select-row">
                <span><strong>${EH.safe(item.name)}</strong><small>${EH.safe(item.status || "")}</small></span>
                <span class="select-row-controls">
                  <label><input type="checkbox" data-use="${item.id}" ${line ? "checked" : ""}> Use</label>
                  <label><input type="checkbox" data-pack="${item.id}" ${line?.packed ? "checked" : ""} ${line ? "" : "disabled"}> Packed</label>
                </span>
              </label>
            `;
          }).join("") : `<div class="empty">No inventory items.</div>`}
        </div>
      </div>
      <div class="modal-foot"><button class="btn primary" id="saveManage">Save</button></div>
    `);

    document.getElementById("closeManage").onclick = EH.closeModal;
    const modal = document.querySelector(".modal");

    modal.querySelectorAll("[data-use]").forEach(checkbox => {
      checkbox.onchange = () => {
        const packed = modal.querySelector(`[data-pack="${checkbox.dataset.use}"]`);
        packed.disabled = !checkbox.checked;
        if (!checkbox.checked) packed.checked = false;
      };
    });

    document.getElementById("saveManage").onclick = async () => {
      for (const line of current) await EHDB.remove("eventItems", line.id);

      for (const checkbox of modal.querySelectorAll("[data-use]:checked")) {
        const itemId = checkbox.dataset.use;
        const item = items.find(i => i.id === itemId);
        const packed = modal.querySelector(`[data-pack="${itemId}"]`).checked;
        await EHDB.put("eventItems", {
          id: EH.uid("EVI"),
          projectId,
          eventId: event.id,
          itemId,
          itemName: item.name,
          packed,
          createdAt: EH.now()
        });
      }

      EH.closeModal();
      EH.toast("Event equipment updated.");
      render();
    };
  }

  render();
})();
