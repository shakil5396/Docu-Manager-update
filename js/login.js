(() => {
  const form = document.getElementById('loginForm');
  if (!form) return;
  let registering = false;
  const errorBox = document.getElementById('authError');
  const showError = message => { errorBox.textContent = message; errorBox.hidden = false; };
  const setMode = value => {
    registering = value;
    document.getElementById('authTitle').textContent = value ? 'Create your account' : 'Welcome back';
    document.getElementById('authIntro').textContent = value ? 'Start a personal space for the files you value.' : 'Sign in to your account to continue.';
    document.getElementById('nameWrap').hidden = !value;
    form.elements.name.required = value;
    form.elements.password.autocomplete = value ? 'new-password' : 'current-password';
    form.querySelector('button[type=submit]').innerHTML = value ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
    document.getElementById('switchPrompt').textContent = value ? 'Already have an account?' : 'New to Folio?';
    document.getElementById('switchMode').textContent = value ? 'Sign in' : 'Create an account';
    document.getElementById('forgotLink').hidden = value;
    errorBox.hidden = true;
  };
  document.getElementById('switchMode').addEventListener('click', () => setMode(!registering));
  if (new URLSearchParams(location.search).get('mode') === 'register') setMode(true);
  form.addEventListener('submit', async event => {
    event.preventDefault(); errorBox.hidden = true;
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type=submit]');
    const old = button.innerHTML; button.disabled = true; button.textContent = registering ? 'Creating account…' : 'Signing in…';
    const payload = { email: form.elements.email.value.trim(), password: form.elements.password.value };
    if (registering) payload.name = form.elements.name.value.trim();
    try {
      const response = await fetch(`/api/auth/${registering ? 'register' : 'login'}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to sign in.');
      location.replace('dashboard.html');
    } catch (error) { showError(error.message || 'Could not connect to the vault. Start the server and try again.'); button.disabled = false; button.innerHTML = old; }
  });
  fetch('/api/auth/me', { credentials: 'same-origin' }).then(response => { if (response.ok) location.replace('dashboard.html'); }).catch(() => {});
})();
