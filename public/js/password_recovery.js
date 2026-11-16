(() => {
  const requestForm = document.getElementById('request-form');
  const resetForm = document.getElementById('reset-form');
  const message = document.getElementById('recovery-message');
  const again = document.getElementById('request-again');
  let token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const isReset = location.pathname.endsWith('/reset-password');
  // Evita dejar el enlace sensible en la barra de direcciones y el historial.
  if (location.hash) history.replaceState(null, '', location.pathname);

  function notify(text, success) {
    message.textContent = text;
    message.className = `form-message form-message--${success ? 'success' : 'error'}`;
    message.hidden = false;
  }

  if (isReset) {
    requestForm.hidden = true;
    resetForm.hidden = !token;
    again.hidden = false;
    document.getElementById('recovery-title').textContent = 'Nueva contraseña';
    document.getElementById('recovery-description').textContent = 'Escribe y confirma la contraseña que usarás para ingresar.';
    if (!token) notify('Abre el enlace de tu correo o solicita uno nuevo.', false);
  }

  async function submit(form, endpoint, body) {
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Procesando…';
    message.hidden = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await response.json();
      notify(data.message, response.ok);
      if (response.ok && form === resetForm) {
        token = '';
        form.reset();
        form.hidden = true;
        again.hidden = true;
      }
    } catch {
      notify('No se pudo conectar. Revisa tu conexión e intenta nuevamente.', false);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }
  requestForm.addEventListener('submit', event => {
    event.preventDefault();
    submit(requestForm, '/auth/forgot-password', { email: document.getElementById('recovery-email').value.trim() });
  });
  resetForm.addEventListener('submit', event => {
    event.preventDefault();
    const password = document.getElementById('new-password').value;
    const confirmation = document.getElementById('confirm-password').value;
    if (password !== confirmation) return notify('Las contraseñas no coinciden.', false);
    submit(resetForm, '/auth/reset-password', { token, password, confirmation });
  });
})();
