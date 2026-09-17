(function () {
  const KEY = "equipmentHub.localSession";

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }

  function signIn(email, name) {
    const session = {
      email: String(email || "").trim(),
      name: String(name || "").trim() || String(email || "").split("@")[0] || "Local User",
      signedInAt: new Date().toISOString()
    };
    localStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }

  function signOut() {
    localStorage.removeItem(KEY);
    localStorage.removeItem("equipmentHub.currentProjectId");
    location.href = "index.html";
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      location.replace("index.html");
      return null;
    }
    return session;
  }

  window.EHAuth = { getSession, signIn, signOut, requireAuth };
})();
