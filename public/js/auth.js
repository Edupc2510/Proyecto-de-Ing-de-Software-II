// public/js/auth.js
// Lógica del frontend para autenticación: registro, login, verificación

// ─────────────────────────────────────────────────────────────
// Estado compartido del módulo
// ─────────────────────────────────────────────────────────────
let pendingEmail = '';

// ─────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────

/**
 * Muestra un mensaje de estado en el formulario.
 * @param {string} elementId - ID del elemento de mensaje
 * @param {string} type - 'error' | 'success' | 'info'
 * @param {string} text - Texto a mostrar
 */
function showMessage(elementId, type, text) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `form-message form-message--${type}`;
  el.innerHTML = text;
  el.style.display = 'flex';
}

/**
 * Oculta el mensaje de estado.
 * @param {string} elementId
 */
function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = 'none';
}

/**
 * Alterna visibilidad de contraseña.
 * @param {string} inputId - ID del input de contraseña
 * @param {HTMLElement} btn - Botón que fue presionado
 */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.innerHTML = isPassword
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

/**
 * Establece el estado de carga en un botón.
 * @param {string} btnId
 * @param {boolean} loading
 * @param {string} originalLabel
 */
function setButtonLoading(btnId, loading, originalLabel = '') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = `<div class="spinner"></div> Procesando...`;
  } else {
    btn.innerHTML = originalLabel;
  }
}

// ─────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────

/**
 * Cambia entre las pestañas de login, registro y verificación.
 * @param {string} tab - 'login' | 'register' | 'verify'
 */
function switchTab(tab) {
  const forms = ['login', 'register', 'verify'];
  forms.forEach(f => {
    const formEl = document.getElementById(`form-${f}`);
    const tabEl  = document.getElementById(`tab-${f}`);
    if (formEl) formEl.style.display = (f === tab) ? 'flex' : 'none';
    if (tabEl) {
      tabEl.classList.toggle('auth-tab--active', f === tab);
    }
  });

  // Ocultar mensajes al cambiar de pestaña
  ['login-message', 'register-message', 'verify-message'].forEach(hideMessage);
}

// ─────────────────────────────────────────────────────────────
// REGISTRO
// ─────────────────────────────────────────────────────────────

async function handleRegister() {
  hideMessage('register-message');

  const firstName = document.getElementById('reg-firstname').value.trim();
  const lastName  = document.getElementById('reg-lastname').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const dni       = document.getElementById('reg-dni').value.trim();
  const password  = document.getElementById('reg-password').value;
  const termsAccepted = document.getElementById('reg-terms').checked;

  // Validación de frontend
  if (!firstName || !lastName || !email || !dni || !password) {
    showMessage('register-message', 'error', '⚠️ Completa todos los campos.');
    return;
  }
  
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    showMessage('register-message', 'error', '⚠️ Ingresa un correo válido.');
    return;
  }

  if (!/^\d{8}$/.test(dni)) {
    showMessage('register-message', 'error', '⚠️ El DNI debe tener 8 dígitos numéricos.');
    return;
  }

  if (password.length < 6) {
    showMessage('register-message', 'error', '⚠️ La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  if (!termsAccepted) {
    showMessage('register-message', 'error', '⚠️ Debes aceptar los términos y condiciones para continuar.');
    return;
  }

  setButtonLoading('btn-register', true);

  try {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, dni, password }),
    });

    const data = await response.json();

    if (data.success) {
      pendingEmail = email;

      // Si el servidor devuelve código de desarrollo, mostrarlo
      if (data.devCode) {
        const devBox = document.getElementById('dev-code-box');
        const devVal = document.getElementById('dev-code-value');
        if (devBox && devVal) {
          devVal.textContent = data.devCode;
          devBox.style.display = 'block';
        }
      }

      // Actualizar descripción con el email
      const desc = document.getElementById('verify-desc');
      if (desc) {
        desc.textContent = `Ingresa el código de 6 dígitos que enviamos a ${email}.`;
      }

      switchTab('verify');
      setupCodeInputs();
    } else {
      showMessage('register-message', 'error', `⚠️ ${data.message}`);
    }
  } catch (err) {
    showMessage('register-message', 'error', '⚠️ Error de conexión. Intenta de nuevo.');
  } finally {
    setButtonLoading('btn-register', false, `<span>Crear cuenta</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`);
  }
}

// ─────────────────────────────────────────────────────────────
// VERIFICACIÓN
// ─────────────────────────────────────────────────────────────

/**
 * Configura el comportamiento de los 6 inputs del código.
 * Navega automáticamente entre celdas y permite pegar el código.
 */
function setupCodeInputs() {
  const inputs = document.querySelectorAll('.code-input');

  inputs.forEach((input, index) => {
    // Limpiar valor previo
    input.value = '';
    input.classList.remove('filled');

    // Al escribir un dígito, pasar al siguiente
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val;
      if (val) {
        input.classList.add('filled');
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else {
        input.classList.remove('filled');
      }
    });

    // Backspace: volver al anterior
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    // Pegar código completo
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      [...pasted].slice(0, 6).forEach((char, i) => {
        if (inputs[i]) {
          inputs[i].value = char;
          inputs[i].classList.add('filled');
        }
      });
      const nextEmpty = [...inputs].findIndex(inp => !inp.value);
      if (nextEmpty !== -1) inputs[nextEmpty].focus();
      else inputs[5].focus();
    });
  });

  // Enfocar primer input
  if (inputs.length > 0) inputs[0].focus();
}

async function handleVerify() {
  hideMessage('verify-message');

  const inputs = document.querySelectorAll('.code-input');
  const code = [...inputs].map(inp => inp.value).join('');

  if (code.length < 6) {
    showMessage('verify-message', 'error', '⚠️ Ingresa el código completo de 6 dígitos.');
    return;
  }

  if (!pendingEmail) {
    showMessage('verify-message', 'error', '⚠️ No se encontró el correo pendiente. Regístrate de nuevo.');
    return;
  }

  setButtonLoading('btn-verify', true);

  try {
    const response = await fetch('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, code }),
    });

    const data = await response.json();

    if (data.success) {
      showMessage('verify-message', 'success', '✅ ¡Cuenta verificada! Redirigiendo al login...');
      setTimeout(() => {
        pendingEmail = '';
        switchTab('login');
        document.getElementById('login-email').value = document.getElementById('reg-email').value || '';
        showMessage('login-message', 'success', '✅ Cuenta verificada. Ya puedes iniciar sesión.');
      }, 2000);
    } else {
      showMessage('verify-message', 'error', `⚠️ ${data.message}`);
    }
  } catch (err) {
    showMessage('verify-message', 'error', '⚠️ Error de conexión. Intenta de nuevo.');
  } finally {
    setButtonLoading('btn-verify', false, '<span>Verificar código</span>');
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────

async function handleLogin() {
  hideMessage('login-message');

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showMessage('login-message', 'error', '⚠️ Ingresa tu correo y contraseña.');
    return;
  }

  setButtonLoading('btn-login', true);

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      showMessage('login-message', 'success', '✅ Sesión iniciada. Redirigiendo...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } else {
      showMessage('login-message', 'error', `⚠️ ${data.message}`);
      setButtonLoading('btn-login', false, `<span>Ingresar</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`);
    }
  } catch (err) {
    showMessage('login-message', 'error', '⚠️ Error de conexión. Intenta de nuevo.');
    setButtonLoading('btn-login', false, `<span>Ingresar</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`);
  }
}

// ─────────────────────────────────────────────────────────────
// ENTER KEY SUPPORT
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;

  const loginActive   = document.getElementById('form-login')   && document.getElementById('form-login').style.display !== 'none';
  const registerActive = document.getElementById('form-register') && document.getElementById('form-register').style.display !== 'none';
  const verifyActive  = document.getElementById('form-verify')  && document.getElementById('form-verify').style.display !== 'none';

  if (loginActive)    handleLogin();
  if (registerActive) handleRegister();
  if (verifyActive)   handleVerify();
});

// ─────────────────────────────────────────────────────────────
// DETECCIÓN DE HASH
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#registro') {
    switchTab('register');
  }
});
