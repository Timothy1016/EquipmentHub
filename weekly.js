(async function () {
  const project = await EH.shell("weekly", "Weekly Check", "Run a quick physical inventory check.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");

  async function render() {
    const [items, checks] = await Promise.all([
      EHDB.listForProject("items", projectId),
      EHDB.listForProject("checks", projectId)
    ]);
    const activeItems = items.filter(i => !i.archived);
    const sorted = checks.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    root.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <span class="mini-label">PHYSICAL CHECK</span>
          <h2>Start weekly check</h2>
          <p class="subtle">Confirm which equipment you can physically verify today.</p>
          <button class="btn primary" id="startCheck">Start check</button>
        </div>

        <div class="card">
          <span class="mini-label">LAST CHECK</span>
          <h2>${sorted[0] ? EH.fmtDate(sorted[0].createdAt) : "Never"}</h2>
          <p class="subtle">${sorted[0] ? `${sorted[0].presentCount}/${sorted[0].totalCount} present` : "No check has been saved yet."}</p>
        </div>
      </div>

      <div class="section-title"><h2>Check history</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Present</th><th>Total</th><th>Missing</th><th>Operator</th></tr></thead>
          <tbody>
            ${sorted.length ? sorted.map(check => `<tr><td>${EH.fmtDate(check.createdAt)}</td><td>${check.presentCount}</td><td>${check.totalCount}</td><td>${check.missingCount}</td><td>${EH.safe(check.operator || "-")}</td></tr>`).join("") : `<tr><td colspan="5"><div class="empty">No checks yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("startCheck").onclick = () => openCheck(activeItems);
  }

  function openCheck(items) {
    EH.openModal(`
      <form id="checkForm">
        <div class="modal-head"><strong>Weekly equipment check</strong><button type="button" class="icon-button" id="closeCheck">×</button></div>
        <div class="modal-body">
          <div class="stack-list">
            ${items.length ? items.map(item => `<label class="select-row"><span>${EH.safe(item.name)}</span><input type="checkbox" name="present" value="${item.id}" checked></label>`).join("") : `<div class="empty">No inventory items.</div>`}
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" id="cancelCheck">Cancel</button><button class="btn primary">Save check</button></div>
      </form>
    `);

    document.getElementById("closeCheck").onclick =
      document.getElementById("cancelCheck").onclick = EH.closeModal;

    document.getElementById("checkForm").onsubmit = async event => {
      event.preventDefault();
      const present = [...event.target.querySelectorAll('input[name="present"]:checked')].map(x => x.value);
      const session = EHAuth.getSession();
      await EHDB.put("checks", {
        id: EH.uid("CHK"),
        projectId,
        createdAt: EH.now(),
        operator: session?.name || "Local User",
        totalCount: items.length,
        presentCount: present.length,
        missingCount: items.length - present.length,
        presentIds: present
      });
      EH.closeModal();
      EH.toast("Weekly check saved.");
      render();
    };
  }

  render();
})();
