(async function () {
  const project = await EH.shell("activity", "Activity", "Audit equipment movement history.");
  if (!project) return;
  const projectId = project.id;
  const root = document.getElementById("pageRoot");

  const rows = (await EHDB.listForProject("movements", projectId))
    .slice()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  root.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Item</th><th>Action</th><th>From</th><th>To</th><th>Person</th><th>Operator</th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => `
            <tr>
              <td>${EH.fmtDate(row.createdAt)}</td>
              <td>${EH.safe(row.itemName || row.itemId || "-")}</td>
              <td>${EH.safe(row.action || "-")}</td>
              <td>${EH.safe(row.fromLocation || "-")}</td>
              <td>${EH.safe(row.toLocation || "-")}</td>
              <td>${EH.safe(row.toPerson || row.fromPerson || "-")}</td>
              <td>${EH.safe(row.operator || "-")}</td>
            </tr>
          `).join("") : `<tr><td colspan="7"><div class="empty">No activity yet.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
})();
