(() => {
  const message = document.getElementById('resetMessage');
  const show = (text, error = false) => { message.textContent = text; message.hidden = false; message.classList.toggle('is-error', error); };
  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) forgotForm.addEventListener('submit', async event => {
    event.preventDefault(); if (!forgotForm.reportValidity()) return; const button = forgotForm.querySelector('button'); button.disabled = true;
    try { const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotForm.elements.email.value.trim() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Reset email could not be sent.'); show(data.message); forgotForm.reset(); } catch (error) { show(error.message, true); } finally { button.disabled = false; }
  });
  const resetForm = document.getElementById('resetForm');
  if (resetForm) resetForm.addEventListener('submit', async event => {
    event.preventDefault(); if (!resetForm.reportValidity()) return; if (resetForm.elements.password.value !== resetForm.elements.confirmPassword.value) return show('The passwords do not match.', true); const token = new URLSearchParams(location.search).get('token'); if (!token) return show('This reset link is missing or invalid.', true); const button = resetForm.querySelector('button'); button.disabled = true;
    try { const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: resetForm.elements.password.value }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Password could not be updated.'); show(`${data.message} You can now sign in.`); resetForm.reset(); } catch (error) { show(error.message, true); } finally { button.disabled = false; }
  });
})();
