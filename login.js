(function () {
  const root = document.getElementById("loginRoot");
  const existing = EHAuth.getSession();
  if (existing) {
    location.replace("projects.html");
    return;
  }

  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-topbar">
        <div class="auth-brand"><span>E</span><strong>EquipmentHub</strong></div>
        <button class="theme-toggle" data-theme-toggle type="button"></button>
      </div>

      <form class="auth-card" id="loginForm">
        <h1>Sign in</h1>
        <p>Continue to your equipment projects.</p>

        <div class="field">
          <label>Name</label>
          <input class="input" name="name" required autocomplete="name" placeholder="Your name">
        </div>

        <div class="field">
          <label>Email</label>
          <input class="input" type="email" name="email" required autocomplete="email" placeholder="you@example.com">
        </div>

        <div class="field">
          <label>Password</label>
          <input class="input" type="password" name="password" required minlength="4" autocomplete="current-password" placeholder="••••••••">
        </div>

        <button class="btn primary auth-submit">Sign in</button>
        <small class="auth-note">Local prototype login. Account data stays in this browser.</small>
      </form>
    </div>
  `;

  EHTheme.refresh();

  document.getElementById("loginForm").onsubmit = event => {
    event.preventDefault();
    const form = new FormData(event.target);
    EHAuth.signIn(form.get("email"), form.get("name"));
    location.href = "projects.html";
  };
})();
