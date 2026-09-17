(async function () {
  const project = await EH.shell("dashboard", "Dashboard", "Key equipment status and what needs attention.");
  if (!project) return;

  const projectId = project.id;
  await EH.seedDefaults(projectId);
  const root = document.getElementById("pageRoot");

  const [items, events, eventItems, maintenance, movements] = await Promise.all([
    EHDB.listForProject("items", projectId),
    EHDB.listForProject("events", projectId),
    EHDB.listForProject("eventItems", projectId),
    EHDB.listForProject("maintenance", projectId),
    EHDB.listForProject("movements", projectId)
  ]);

  const activeItems = items.filter(i => !i.archived);
  const count = status => activeItems.filter(i => i.status === status).length;
  const openMaint = maintenance.filter(m => !["Resolved", "Unrepairable"].includes(m.status));
  const activeEvents = events.filter(e => e.status !== "Completed")
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  const alerts = [];
  if (count("Missing")) alerts.push(["danger", `${count("Missing")} missing item${count("Missing") > 1 ? "s" : ""}`, "Confirm where the equipment is."]);
  const low = activeItems.filter(i => i.type === "quantity" && Number(i.quantity || 0) <= Number(i.minStock || 0));
  if (low.length) alerts.push(["warning", `${low.length} low-stock item${low.length > 1 ? "s" : ""}`, "Stock has reached its minimum level."]);
  if (openMaint.length) alerts.push(["warning", `${openMaint.length} maintenance task${openMaint.length > 1 ? "s" : ""}`, "Equipment needs inspection or repair."]);

  if (activeEvents[0]) {
    const event = activeEvents[0];
    const lines = eventItems.filter(x => x.eventId === event.id);
    const packed = lines.filter(x => x.packed).length;
    const ready = lines.length ? Math.round(packed / lines.length * 100) : 0;
    if (!lines.length) alerts.push(["info", `${event.name} has no equipment list`, "Add required equipment before the event."]);
    else if (ready < 100) alerts.push(["info", `${event.name} is ${ready}% ready`, `${lines.length - packed} item${lines.length - packed !== 1 ? "s" : ""} still need packing.`]);
  }

  root.innerHTML = `
    <div class="dashboard-clean">
      <div class="dashboard-actions-row">
        <div class="workspace-summary">
          <span class="mini-label">PROJECT</span>
          <strong>${EH.safe(project.name)}</strong>
          <small>${EH.safe(project.primaryLocation || "No primary location")}</small>
        </div>

        <div class="quick-actions">
          <a class="btn primary" href="inventory.html">+ Add item</a>
          <a class="btn" href="events.html">+ Create event</a>
          <a class="btn" href="weekly-check.html">Start check</a>
        </div>
      </div>

      <section class="summary-grid">
        ${stat("Total", activeItems.length, "All tracked items", "")}
        ${stat("Available", count("Available"), "Ready to use", "available")}
        ${stat("On Site", count("On Site"), "In operation", "info")}
        ${stat("With Person", count("With Person"), "Assigned custody", "info")}
        ${stat("Maintenance", count("Maintenance"), "Unavailable", "warn")}
        ${stat("Missing", count("Missing"), "Needs attention", "danger")}
      </section>

      <section class="dashboard-main-grid">
        <article class="clean-panel">
          <div class="clean-panel-head">
            <div><span class="mini-label">PRIORITY</span><h2>Needs attention</h2></div>
          </div>
          <div class="stack-list">
            ${alerts.length ? alerts.map(a => `
              <div class="clean-list-item ${a[0]}">
                <span class="clean-list-dot"></span>
                <div><strong>${EH.safe(a[1])}</strong><p>${EH.safe(a[2])}</p></div>
              </div>
            `).join("") : `
              <div class="clean-empty-state"><strong>Everything looks good.</strong><p>No urgent action right now.</p></div>
            `}
          </div>
        </article>

        <article class="clean-panel">
          <div class="clean-panel-head">
            <div><span class="mini-label">EVENTS</span><h2>Upcoming / active</h2></div>
          </div>
          <div class="stack-list">
            ${activeEvents.length ? activeEvents.slice(0, 4).map(event => {
              const lines = eventItems.filter(x => x.eventId === event.id);
              const packed = lines.filter(x => x.packed).length;
              const ready = lines.length ? Math.round(packed / lines.length * 100) : 0;
              return `
                <div class="event-row-card">
                  <div><strong>${EH.safe(event.name)}</strong><p>${EH.safe(event.date || "No date")} · ${EH.safe(event.status || "Planned")}</p></div>
                  <div class="event-progress-mini"><span>${ready}% ready</span><small>${packed}/${lines.length} packed</small></div>
                </div>`;
            }).join("") : `<div class="clean-empty-state"><strong>No active event.</strong><p>Create one when preparing for onsite work.</p></div>`}
          </div>
        </article>
      </section>

      <article class="clean-panel">
        <div class="clean-panel-head">
          <div><span class="mini-label">ACTIVITY</span><h2>Recent activity</h2></div>
        </div>
        <div class="stack-list">
          ${movements.length ? movements.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6).map(m => `
            <div class="activity-row-card">
              <div><strong>${EH.safe(m.itemName || m.action || "Activity")}</strong><p>${EH.safe(m.action || "Movement")} · ${EH.fmtDate(m.createdAt)}</p></div>
              <span class="activity-tag">${EH.safe(m.operator || "-")}</span>
            </div>
          `).join("") : `<div class="clean-empty-state"><strong>No movement yet.</strong><p>Transfers and returns will appear here.</p></div>`}
        </div>
      </article>
    </div>
  `;

  function stat(label, value, text, cls) {
    return `<article class="summary-card ${cls}"><span>${label}</span><strong>${value}</strong><small>${text}</small></article>`;
  }
})();
