(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('loginForm'); if (!form) return;
  let registering = false, verificationEmail = '', resendTimer = null;
  const errorBox = $('authError');
  const showError = message => { errorBox.textContent = message; errorBox.hidden = false; errorBox.classList.remove('is-success'); };
  const clearError = () => { errorBox.textContent = ''; errorBox.hidden = true; errorBox.classList.remove('is-success'); };
  const setMode = value => {
    registering = value; clearError(); $('verificationPanel').hidden = true; form.hidden = false;
    $('authTitle').textContent = value ? 'Create your account' : 'Welcome back';
    $('authIntro').textContent = value ? 'A private place for the files you value.' : 'Sign in to your account to continue.';
    $('nameWrap').hidden = !value; $('confirmPasswordWrap').hidden = !value;
    form.elements.name.required = value; form.elements.confirmPassword.required = value;
    form.elements.password.autocomplete = value ? 'new-password' : 'current-password';
    $('togglePassword').textContent = 'Show'; $('togglePassword').setAttribute('aria-label', 'Show password'); form.elements.password.type = 'password';
    form.querySelector('button[type=submit]').innerHTML = value ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
    $('authModeSwitch').hidden = false; $('modeSignIn').classList.toggle('is-active', !value); $('modeSignUp').classList.toggle('is-active', value); $('modeSignIn').setAttribute('aria-pressed', String(!value)); $('modeSignUp').setAttribute('aria-pressed', String(value));
    $('forgotLink').hidden = value; $('authDivider').hidden = value; $('googleLogin').hidden = value;
  };
  function showVerification(email) {
    verificationEmail = email; $('verificationEmail').textContent = email; $('verificationPanel').hidden = false; form.hidden = true;
    $('authTitle').textContent = 'Verify your email'; $('authIntro').textContent = 'One quick check before you enter your private vault.';
    $('forgotLink').hidden = true; $('authDivider').hidden = true; $('googleLogin').hidden = true; $('authModeSwitch').hidden = true;
    $('verificationCode').value = ''; clearError(); startResendTimer(60); $('verificationCode').focus();
  }
  function startResendTimer(seconds) {
    clearInterval(resendTimer); const button = $('resendCode'); let remaining = seconds; button.disabled = remaining > 0;
    const update = () => { button.textContent = remaining > 0 ? `Resend code in ${remaining}s` : 'Resend verification code'; button.disabled = remaining > 0; remaining--; if (remaining < 0) clearInterval(resendTimer); };
    update(); resendTimer = setInterval(update, 1000);
  }
  async function request(path, body) {
    const response = await fetch(`/api/auth/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.message || 'Unable to complete this request.'); error.code = data.code; error.status = response.status; throw error; } return data;
  }
  $('modeSignIn').addEventListener('click', () => setMode(false)); $('modeSignUp').addEventListener('click', () => setMode(true));
  $('togglePassword').addEventListener('click', () => { const input = form.elements.password, visible = input.type === 'password'; input.type = visible ? 'text' : 'password'; $('togglePassword').textContent = visible ? 'Hide' : 'Show'; $('togglePassword').setAttribute('aria-label', visible ? 'Hide password' : 'Show password'); input.focus(); });
  $('backToLogin').addEventListener('click', () => { clearInterval(resendTimer); form.elements.email.value = ''; form.elements.password.value = ''; setMode(false); form.elements.email.focus(); });
  $('resendCode').addEventListener('click', async () => { const button = $('resendCode'); button.disabled = true; try { await request('resend-verification', { email: verificationEmail }); startResendTimer(60); showError('A new code has been sent.'); errorBox.classList.add('is-success'); } catch (error) { showError(error.message); button.disabled = false; } });
  if (new URLSearchParams(location.search).get('mode') === 'register') setMode(true);
  const authError = new URLSearchParams(location.search).get('authError');
  if (authError) { const messages = { 'google-config': 'Google sign-in is not configured yet. Use email and password or ask the administrator to add Google OAuth settings.', 'state': 'Google sign-in expired. Please try again.', 'cancelled': 'Google sign-in was cancelled.', 'exchange': 'Google could not complete sign-in. Please retry.', 'profile': 'Google profile could not be verified.', 'unverified': 'Google did not confirm this email address.', 'link-conflict': 'This email is linked to a different Google account.', 'suspended': 'This account is unavailable. Contact support.', google: 'Google sign-in could not be completed.' }; showError(messages[authError] || messages.google); }
  form.addEventListener('submit', async event => {
    event.preventDefault(); clearError(); if (!form.reportValidity()) return;
    const email = form.elements.email.value.trim().toLowerCase(), password = form.elements.password.value;
    if (registering && !/^[^\s@]+@gmail\.com$/.test(email)) return showError('Use a Gmail address to create a Folio account.');
    if (registering && password !== form.elements.confirmPassword.value) return showError('Your passwords do not match.');
    const button = form.querySelector('button[type=submit]'), old = button.innerHTML; button.disabled = true; button.textContent = registering ? 'Sending verification code…' : 'Signing in…';
    const payload = { email, password }; if (registering) payload.name = form.elements.name.value.trim();
    try {
      const result = await request(registering ? 'register' : 'login', payload);
      if (result.requiresVerification) { showVerification(result.email || email); showError(result.message); errorBox.classList.add('is-success'); return; }
      location.replace('dashboard.html');
    } catch (error) {
      if (error.code === 'EMAIL_NOT_VERIFIED') { showVerification(email); showError('This account needs email verification. Resend a code if the earlier one expired.'); return; }
      if (error.code === 'ACCOUNT_EXISTS' && registering) { setMode(false); showError(error.message); form.elements.email.value = email; }
      else showError(error.message || 'Could not connect to the vault. Try again.');
    } finally { button.disabled = false; button.innerHTML = old; }
  });
  $('verificationForm').addEventListener('submit', async event => {
    event.preventDefault(); clearError(); if (!event.currentTarget.reportValidity()) return;
    const button = event.currentTarget.querySelector('button[type=submit]'), old = button.innerHTML; button.disabled = true; button.textContent = 'Verifying…';
    try { await request('verify-email', { email: verificationEmail, code: $('verificationCode').value.trim() }); location.replace('dashboard.html'); }
    catch (error) { showError(error.message); }
    finally { button.disabled = false; button.innerHTML = old; }
  });
  fetch('/api/auth/me', { credentials: 'same-origin' }).then(response => { if (response.ok) location.replace('dashboard.html'); }).catch(() => {});
})();
