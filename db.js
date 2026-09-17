(function () {
  const DB_NAME = "equipmentHubFinalDB";
  const DB_VERSION = 1;

  const stores = [
    "projects",
    "items",
    "people",
    "locations",
    "events",
    "eventItems",
    "movements",
    "checks",
    "maintenance",
    "reminders"
  ];

  let cachedDB = null;

  function openDB() {
    if (cachedDB) return Promise.resolve(cachedDB);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        stores.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: "id" });
          }
        });
      };

      request.onsuccess = () => {
        cachedDB = request.result;
        cachedDB.onversionchange = () => {
          cachedDB.close();
          cachedDB = null;
        };
        resolve(cachedDB);
      };

      request.onerror = () => reject(request.error);
      request.onblocked = () => alert("Close other EquipmentHub tabs, then refresh.");
    });
  }

  function req(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function objectStore(name, mode = "readonly") {
    const db = await openDB();
    return db.transaction(name, mode).objectStore(name);
  }

  async function getAll(name) {
    return req((await objectStore(name)).getAll());
  }

  async function get(name, id) {
    return req((await objectStore(name)).get(id));
  }

  async function put(name, value) {
    return req((await objectStore(name, "readwrite")).put(value));
  }

  async function remove(name, id) {
    return req((await objectStore(name, "readwrite")).delete(id));
  }

  async function clear(name) {
    return req((await objectStore(name, "readwrite")).clear());
  }

  async function listForProject(name, projectId) {
    const all = await getAll(name);
    return all.filter(row => row.projectId === projectId);
  }

  async function deleteProject(projectId) {
    for (const store of stores.filter(name => name !== "projects")) {
      const rows = await listForProject(store, projectId);
      for (const row of rows) await remove(store, row.id);
    }
    await remove("projects", projectId);
  }

  async function exportProject(projectId) {
    const project = await get("projects", projectId);
    if (!project) throw new Error("Project not found.");

    const data = { projects: [project] };
    for (const store of stores.filter(name => name !== "projects")) {
      data[store] = await listForProject(store, projectId);
    }

    return {
      app: "EquipmentHub",
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      data
    };
  }

  async function importProject(payload, uid) {
    if (!payload || payload.app !== "EquipmentHub" || !payload.data) {
      throw new Error("Invalid EquipmentHub backup.");
    }

    const sourceProject = Array.isArray(payload.data.projects)
      ? payload.data.projects[0]
      : null;

    if (!sourceProject) throw new Error("Backup has no project.");

    const newProjectId = uid("PRJ");
    const now = new Date().toISOString();

    const project = {
      ...sourceProject,
      id: newProjectId,
      name: sourceProject.name || "Imported Project",
      importedAt: now,
      updatedAt: now
    };

    await put("projects", project);

    for (const store of stores.filter(name => name !== "projects")) {
      const rows = Array.isArray(payload.data[store]) ? payload.data[store] : [];
      for (const row of rows) {
        await put(store, {
          ...row,
          id: uid(store.slice(0, 3).toUpperCase()),
          projectId: newProjectId
        });
      }
    }

    return project;
  }

  window.EHDB = {
    stores,
    openDB,
    getAll,
    get,
    put,
    remove,
    clear,
    listForProject,
    deleteProject,
    exportProject,
    importProject
  };
})();
