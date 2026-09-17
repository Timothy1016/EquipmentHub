(function () {
  const SENT_KEY = "equipmentHub.sentNotifications";

  window.addEventListener("load", () => init().catch(console.error));

  async function init() {
    const projectId = EH.getCurrentProjectId();
    const topbar = document.querySelector(".topbar-actions");
    if (!projectId || !topbar) return;

    createButton(topbar);
    createPanel();
    await refresh();
    setupOutside();
    setInterval(() => refresh(false), 30000);
  }

  async function refresh(renderPanelNow = true) {
    const projectId = EH.getCurrentProjectId();
    if (!projectId) return;

    const [items, events, eventItems, maintenance, checks, reminders] = await Promise.all([
      EHDB.listForProject("items", projectId),
      EHDB.listForProject("events", projectId),
      EHDB.listForProject("eventItems", projectId),
      EHDB.listForProject("maintenance", projectId),
      EHDB.listForProject("checks", projectId),
      EHDB.listForProject("reminders", projectId)
    ]);

    const system = buildSystem(items, events, eventItems, maintenance, checks);
    const activeReminders = reminders.filter(r => !r.completed).sort((a, b) => a.remindAt.localeCompare(b.remindAt));
    const due = activeReminders.filter(r => new Date(r.remindAt).getTime() <= Date.now());

    updateCount(system.length + due.length);

    const panel = document.getElementById("notificationPanel");
    if (renderPanelNow || panel?.classList.contains("show")) {
      render(system, activeReminders);
    }

    sendBrowser(due, system);
  }

  function buildSystem(items, events, eventItems, maintenance, checks) {
    const out = [];
    const inventory = items.filter(i => !i.archived);

    const missing = inventory.filter(i => i.status === "Missing");
    if (missing.length) out.push(["critical", "!", "Missing equipment", `${missing.length} item${missing.length > 1 ? "s" : ""} need location confirmation.`, "inventory.html"]);

    const openMaintenance = maintenance.filter(m => !["Resolved", "Unrepairable"].includes(m.status));
    if (openMaintenance.length) out.push(["warning", "⚒", "Maintenance open", `${openMaintenance.length} maintenance task${openMaintenance.length > 1 ? "s" : ""} still open.`, "maintenance.html"]);

    const low = inventory.filter(i => i.type === "quantity" && Number(i.quantity || 0) <= Number(i.minStock || 0));
    if (low.length) out.push(["warning", "↓", "Low stock", `${low.length} item${low.length > 1 ? "s" : ""} reached minimum stock.`, "inventory.html"]);

    const activeEvents = events.filter(e => e.status !== "Completed").sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    if (activeEvents[0]) {
      const lines = eventItems.filter(x => x.eventId === activeEvents[0].id);
      const packed = lines.filter(x => x.packed).length;
      const ready = lines.length ? Math.round(packed / lines.length * 100) : 0;
      if (lines.length && ready < 100) out.push(["info", "◫", "Event not ready", `${activeEvents[0].name} is ${ready}% packed.`, "events.html"]);
    }

    const latest = checks.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
    if (inventory.length && (!latest || (Date.now() - new Date(latest.createdAt).getTime()) / 86400000 >= 7)) {
      out.push(["warning", "✓", "Weekly check due", "Run a physical inventory check.", "weekly-check.html"]);
    }

    return out;
  }

  function createButton(topbar) {
    const button = document.createElement("button");
    button.id = "notificationButton";
    button.className = "notification-button";
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8C6 15 3 16 3 16H21C21 16 18 15 18 8M10 20H14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
      </svg>
      <span class="notification-count hidden" id="notificationCount">0</span>
    `;
    topbar.prepend(button);
    button.onclick = async event => {
      event.stopPropagation();
      const panel = document.getElementById("notificationPanel");
      panel.classList.toggle("show");
      if (panel.classList.contains("show")) await refresh();
    };
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "notificationPanel";
    panel.className = "notification-panel";
    document.body.appendChild(panel);
  }

  function render(system, reminders) {
    const panel = document.getElementById("notificationPanel");
    const now = Date.now();
    const due = reminders.filter(r => new Date(r.remindAt).getTime() <= now);
    const upcoming = reminders.filter(r => new Date(r.remindAt).getTime() > now);

    panel.innerHTML = `
      <div class="notification-head">
        <div><span class="notification-eyebrow">NOTIFICATIONS</span><h3>Reminder center</h3></div>
        <button class="notification-add-button" id="addReminder">+ Reminder</button>
      </div>

      <div class="notification-browser-row">
        <div><strong>Browser alerts</strong><span>Works while EquipmentHub is open.</span></div>
        <button class="notification-permission-button" id="enableNotifications">${permissionLabel()}</button>
      </div>

      ${due.length ? section("DUE NOW", due.map(r => reminderCard(r, true)).join(""), due.length) : ""}
      ${upcoming.length ? section("UPCOMING", upcoming.map(r => reminderCard(r, false)).join(""), upcoming.length) : ""}
      ${section("SYSTEM", system.length ? system.map(systemCard).join("") : `<div class="notification-empty">All systems clear.</div>`, system.length)}
    `;

    document.getElementById("addReminder").onclick = () => openReminder();

    document.getElementById("enableNotifications").onclick = async () => {
      if (!("Notification" in window)) {
        EH.toast("Browser notifications are not supported.");
        return;
      }
      const permission = await Notification.requestPermission();
      EH.toast(permission === "granted" ? "Browser notifications enabled." : "Browser notifications not enabled.");
      refresh();
    };

    panel.querySelectorAll("[data-edit-reminder]").forEach(button => button.onclick = async event => {
      event.stopPropagation();
      const reminder = await EHDB.get("reminders", button.dataset.editReminder);
      if (reminder) openReminder(reminder);
    });

    panel.querySelectorAll("[data-delete-reminder]").forEach(button => button.onclick = async event => {
      event.stopPropagation();
      if (!confirm("Delete this reminder?")) return;
      await EHDB.remove("reminders", button.dataset.deleteReminder);
      refresh();
    });

    panel.querySelectorAll("[data-complete-reminder]").forEach(button => button.onclick = async event => {
      event.stopPropagation();
      const reminder = await EHDB.get("reminders", button.dataset.completeReminder);
      if (!reminder) return;
      reminder.completed = true;
      reminder.completedAt = EH.now();
      await EHDB.put("reminders", reminder);
      refresh();
    });
  }

  function section(title, body, count) {
    return `<div class="notification-section"><div class="notification-section-title"><span>${title}</span><b>${count}</b></div>${body}</div>`;
  }

  function systemCard(item) {
    return `
      <a class="notification-item ${item[0]}" href="${item[4]}">
        <div class="notification-icon">${item[1]}</div>
        <div class="notification-copy"><strong>${EH.safe(item[2])}</strong><span>${EH.safe(item[3])}</span></div>
        <span>→</span>
      </a>
    `;
  }

  function reminderCard(reminder, due) {
    return `
      <div class="scheduled-reminder ${due ? "due" : ""}">
        <div class="scheduled-reminder-icon">${due ? "!" : "◷"}</div>
        <div class="scheduled-reminder-main">
          <strong>${EH.safe(reminder.title)}</strong>
          <span class="reminder-time">${new Date(reminder.remindAt).toLocaleString()}</span>
          ${reminder.notes ? `<p>${EH.safe(reminder.notes)}</p>` : ""}
          <div class="reminder-mini-actions">
            ${reminder.href ? `<a href="${reminder.href}">Open page</a>` : ""}
            <button data-edit-reminder="${reminder.id}">Edit</button>
            <button data-delete-reminder="${reminder.id}">Delete</button>
          </div>
        </div>
        ${due ? `<button class="reminder-complete-button" data-complete-reminder="${reminder.id}">✓</button>` : ""}
      </div>
    `;
  }

  function openReminder(reminder = null) {
    const projectId = EH.getCurrentProjectId();
    const date = reminder ? new Date(reminder.remindAt) : new Date(Date.now() + 86400000);
    const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const timeValue = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

    EH.openModal(`
      <form id="reminderForm">
        <div class="modal-head"><strong>${reminder ? "Edit" : "Schedule"} reminder</strong><button type="button" class="icon-button" id="closeReminder">×</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label>Title *</label><input class="input" name="title" required value="${EH.safe(reminder?.title || "")}"></div>
            <div class="field"><label>Date</label><input class="input" type="date" name="date" required value="${dateValue}"></div>
            <div class="field"><label>Time</label><input class="input" type="time" name="time" required value="${timeValue}"></div>
            <div class="field full"><label>Related page</label><select name="href">${[
              ["", "No related page"],
              ["inventory.html", "Inventory"],
              ["events.html", "Events"],
              ["weekly-check.html", "Weekly Check"],
              ["maintenance.html", "Maintenance"],
              ["reports.html", "Reports / Backup"]
            ].map(x => `<option value="${x[0]}" ${reminder?.href === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select></div>
            <div class="field full"><label>Notes</label><textarea name="notes">${EH.safe(reminder?.notes || "")}</textarea></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelReminder">Cancel</button><button class="btn primary">Save reminder</button></div>
      </form>
    `);

    document.getElementById("closeReminder").onclick =
      document.getElementById("cancelReminder").onclick = EH.closeModal;

    document.getElementById("reminderForm").onsubmit = async event => {
      event.preventDefault();
      const form = new FormData(event.target);
      const remindAt = new Date(`${form.get("date")}T${form.get("time")}:00`);

      await EHDB.put("reminders", {
        id: reminder?.id || EH.uid("REM"),
        projectId,
        title: String(form.get("title") || "").trim(),
        notes: String(form.get("notes") || "").trim(),
        href: form.get("href"),
        remindAt: remindAt.toISOString(),
        completed: false,
        createdAt: reminder?.createdAt || EH.now(),
        updatedAt: EH.now()
      });

      clearSent(reminder?.id);
      EH.closeModal();
      EH.toast("Reminder saved.");
      refresh();
    };
  }

  function updateCount(count) {
    const badge = document.getElementById("notificationCount");
    if (!badge) return;
    if (count <= 0) badge.classList.add("hidden");
    else {
      badge.textContent = count > 99 ? "99+" : count;
      badge.classList.remove("hidden");
    }
  }

  function setupOutside() {
    document.addEventListener("click", event => {
      const panel = document.getElementById("notificationPanel");
      const button = document.getElementById("notificationButton");
      if (panel && !panel.contains(event.target) && !button?.contains(event.target)) {
        panel.classList.remove("show");
      }
    });
  }

  function permissionLabel() {
    if (!("Notification" in window)) return "Unsupported";
    if (Notification.permission === "granted") return "Enabled";
    if (Notification.permission === "denied") return "Blocked";
    return "Enable";
  }

  function sentSet() {
    try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || "[]")); }
    catch { return new Set(); }
  }

  function saveSent(set) {
    localStorage.setItem(SENT_KEY, JSON.stringify([...set]));
  }

  function clearSent(id) {
    if (!id) return;
    const sent = sentSet();
    sent.delete(`reminder:${id}`);
    saveSent(sent);
  }

  function sendBrowser(due, system) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const sent = sentSet();

    due.forEach(reminder => {
      const id = `reminder:${reminder.id}`;
      if (sent.has(id)) return;
      const notification = new Notification(`EquipmentHub · ${reminder.title}`, {
        body: reminder.notes || "Scheduled reminder is due.",
        tag: id
      });
      notification.onclick = () => {
        window.focus();
        if (reminder.href) location.href = reminder.href;
      };
      sent.add(id);
    });

    system.filter(item => item[0] !== "info").forEach(item => {
      const id = `system:${item[2]}:${item[3]}`;
      if (sent.has(id)) return;
      new Notification(`EquipmentHub · ${item[2]}`, { body: item[3], tag: id });
      sent.add(id);
    });

    saveSent(sent);
  }
})();
