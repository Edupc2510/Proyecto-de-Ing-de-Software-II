// public/js/notifications.js
// US31 - Recibir notificación de coincidencia de ruta.
//
// Escenarios de la guía:
//   01 Coincidencia exacta        → al publicarse un viaje con el mismo origen/destino llega un aviso
//   02 Exclusión por horario      → si el viaje sale fuera del rango de la ruta habitual, no llega aviso
//   03 Redirección desde la alerta→ tocar el aviso abre el detalle de ese viaje para reservar
//   04 Agrupación                 → varios viajes seguidos llegan como un solo aviso "Hay N nuevos viajes..."
//   05 Recibir alertas            → el pasajero puede pausar o reactivar los avisos de cada ruta habitual
//
// La coincidencia la calcula el servidor (src/notifications). Este archivo agrega:
//   - la campana del navbar con el panel de avisos (también muestra los de US14 y US34),
//   - el aviso emergente cuando llega algo nuevo,
//   - la tarjeta "Mi ruta habitual" en la vista del pasajero.
// Todo se crea por JavaScript, así dashboard.html solo suma el <link> y el <script>.

(() => {
  const POLL_INTERVAL_MS = 20000;
  const TOAST_DURATION_MS = 10000;
  const MIN_QUERY_LENGTH = 3;
  const SEARCH_DELAY_MS = 500;
  const MAX_ALERTS = 5;

  let notifications = [];
  let unreadCount = 0;
  let hasLoadedOnce = false;
  let knownVersions = new Map(); // id → updatedAt, para detectar avisos nuevos o agrupados
  let pollTimer = null;
  let toastTimer = null;

  let alerts = [];
  const selected = { origin: null, dest: null }; // { name, coords }

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  const shortPlace = (text) => String(text || '').split(',')[0].trim();

  function timeAgo(dateString) {
    const diff = Math.max(0, Date.now() - new Date(dateString).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    return new Date(dateString).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }

  const ICONS = {
    route_match: '🚗',
    route_cancelled: '⚠️',
    new_request: '🙋',
  };

  // ─────────────────────────────────────────────────────────────
  // CAMPANA Y PANEL
  // ─────────────────────────────────────────────────────────────
  function ensureBell() {
    let wrapper = document.getElementById('notif-bell-wrapper');
    if (wrapper) return wrapper;

    const userButton = document.getElementById('navbar-user');
    if (!userButton) return null;

    wrapper = document.createElement('div');
    wrapper.id = 'notif-bell-wrapper';
    wrapper.className = 'notif';
    wrapper.innerHTML = `
      <button type="button" class="notif__bell" id="notif-bell" aria-label="Notificaciones" aria-expanded="false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        <span class="notif__count" id="notif-count" hidden>0</span>
      </button>
      <div class="notif__panel" id="notif-panel" hidden>
        <div class="notif__panel-header">
          <strong>Notificaciones</strong>
          <button type="button" class="notif__read-all" data-action="read-all">Marcar todas como leídas</button>
        </div>
        <ul class="notif__list" id="notif-list"></ul>
      </div>
    `;
    userButton.insertAdjacentElement('beforebegin', wrapper);

    wrapper.querySelector('#notif-bell').addEventListener('click', (event) => {
      event.stopPropagation();
      togglePanel();
    });

    wrapper.querySelector('#notif-panel').addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target.closest('[data-action="read-all"]')) {
        markAllRead();
        return;
      }
      const item = event.target.closest('.notif-item');
      if (item) openNotification(item.dataset.id);
    });

    document.addEventListener('click', () => togglePanel(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') togglePanel(false);
    });

    return wrapper;
  }

  function togglePanel(force) {
    const panel = document.getElementById('notif-panel');
    const bell = document.getElementById('notif-bell');
    if (!panel || !bell) return;

    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open) renderList();
  }

  function renderCount() {
    const badge = document.getElementById('notif-count');
    if (!badge) return;
    badge.hidden = unreadCount === 0;
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
  }

  function renderList() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    const readAll = document.querySelector('#notif-panel [data-action="read-all"]');
    if (readAll) readAll.hidden = unreadCount === 0;

    if (notifications.length === 0) {
      list.innerHTML = `
        <li class="notif__empty">
          No tienes notificaciones.<br>
          Configura tu ruta habitual (vista Pasajero) para enterarte cuando salga un viaje que te sirva.
        </li>
      `;
      return;
    }

    list.innerHTML = notifications.map(n => `
      <li>
        <button type="button" class="notif-item ${n.read ? '' : 'notif-item--unread'} ${n.priority === 'alta' ? 'notif-item--high' : ''}" data-id="${escapeText(n.id)}">
          <span class="notif-item__icon">${ICONS[n.type] || '🔔'}</span>
          <span class="notif-item__body">
            <span class="notif-item__title">${escapeText(n.title)}</span>
            <span class="notif-item__message">${escapeText(n.message)}</span>
            <span class="notif-item__time">${escapeText(timeAgo(n.updatedAt || n.createdAt))}</span>
          </span>
          ${n.read ? '' : '<span class="notif-item__dot" aria-label="Sin leer"></span>'}
        </button>
      </li>
    `).join('');
  }

  // ─────────────────────────────────────────────────────────────
  // CARGA PERIÓDICA
  // ─────────────────────────────────────────────────────────────
  async function loadNotifications() {
    try {
      const res = await fetch('/notifications');
      if (res.status === 401) {
        stopPolling();
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      const incoming = Array.isArray(data.notifications) ? data.notifications : [];

      // Escenario 01/04: un aviso es "nuevo" si no lo conocíamos o si se agrupó (cambió updatedAt)
      const fresh = hasLoadedOnce
        ? incoming.filter(n => !n.read && knownVersions.get(n.id) !== (n.updatedAt || n.createdAt))
        : [];

      knownVersions = new Map(incoming.map(n => [n.id, n.updatedAt || n.createdAt]));
      notifications = incoming;
      unreadCount = Number(data.unreadCount) || incoming.filter(n => !n.read).length;
      hasLoadedOnce = true;

      renderCount();
      const panel = document.getElementById('notif-panel');
      if (panel && !panel.hidden) renderList();

      if (fresh.length > 0) showToast(fresh[0]);
    } catch (error) {
      // Sin conexión: se vuelve a intentar en el siguiente ciclo
      console.warn('[Notificaciones] No se pudieron cargar:', error.message);
    }
  }

  function startPolling() {
    stopPolling();
    loadNotifications();
    pollTimer = setInterval(() => {
      if (!document.hidden) loadNotifications();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function markRead(id) {
    const n = notifications.find(item => item.id === id);
    if (!n || n.read) return;

    n.read = true;
    unreadCount = Math.max(0, unreadCount - 1);
    renderCount();
    renderList();

    try {
      await fetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
    } catch (error) {
      console.warn('[Notificaciones] No se pudo marcar como leída:', error.message);
    }
  }

  async function markAllRead() {
    notifications.forEach(n => { n.read = true; });
    unreadCount = 0;
    renderCount();
    renderList();

    try {
      await fetch('/notifications/read-all', { method: 'PATCH' });
    } catch (error) {
      console.warn('[Notificaciones] No se pudieron marcar como leídas:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // AVISO EMERGENTE
  // ─────────────────────────────────────────────────────────────
  function showToast(notification) {
    let toast = document.getElementById('notif-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'notif-toast';
      toast.className = 'notif-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);

      toast.addEventListener('click', (event) => {
        if (event.target.closest('[data-action="close-toast"]')) {
          hideToast();
          return;
        }
        const id = toast.dataset.id;
        hideToast();
        if (id) openNotification(id);
      });

      // Mientras el mouse está encima, el aviso no se cierra solo
      toast.addEventListener('mouseenter', () => clearTimeout(toastTimer));
      toast.addEventListener('mouseleave', () => {
        clearTimeout(toastTimer);
        toastTimer = setTimeout(hideToast, TOAST_DURATION_MS / 2);
      });
    }

    toast.dataset.id = notification.id;
    toast.classList.toggle('notif-toast--high', notification.priority === 'alta');
    toast.innerHTML = `
      <span class="notif-toast__icon">${ICONS[notification.type] || '🔔'}</span>
      <span class="notif-toast__body">
        <strong>${escapeText(notification.title)}</strong>
        <span>${escapeText(notification.message)}</span>
        <small>Toca para ver</small>
      </span>
      <button type="button" class="notif-toast__close" data-action="close-toast" aria-label="Cerrar">×</button>
    `;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('notif-toast--visible'));

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_DURATION_MS);
  }

  function showInfoToast(message) {
    showToast({ id: '', type: 'info', title: 'Aviso', message, priority: 'normal' });
  }

  function hideToast() {
    const toast = document.getElementById('notif-toast');
    if (!toast) return;
    toast.classList.remove('notif-toast--visible');
    clearTimeout(toastTimer);
  }

  // ─────────────────────────────────────────────────────────────
  // ESCENARIO 03: QUÉ PASA AL TOCAR UN AVISO
  // ─────────────────────────────────────────────────────────────
  // Cambia a la vista indicada. Devuelve true si cambió (selectRole ya recarga sus listas).
  function goToRole(role) {
    if (typeof currentRole !== 'undefined' && currentRole === role) return false;
    if (typeof window.selectRole === 'function') window.selectRole(role);
    return true;
  }

  function openNotification(id) {
    const n = notifications.find(item => item.id === id);
    if (!n) return;

    markRead(id);
    togglePanel(false);

    if (n.type === 'route_match') {
      const routeIds = Array.isArray(n.routeIds) ? n.routeIds : [];
      if (n.routeId && routeIds.length <= 1) {
        openTripDetail(n.routeId);
      } else {
        // Aviso agrupado (escenario 04): se muestra la lista de rutas disponibles
        scrollToPassengerRoutes(!goToRole('passenger'));
      }
      return;
    }

    if (n.type === 'new_request' && n.routeId) {
      goToRole('driver');
      if (typeof window.openRequestsModal === 'function') window.openRequestsModal(n.routeId);
      return;
    }

    if (n.type === 'route_cancelled') {
      scrollToPassengerRoutes(!goToRole('passenger'));
    }
  }

  function scrollToPassengerRoutes(reload = true) {
    // Recargar la lista para que aparezcan los viajes recién publicados
    if (reload && typeof window.loadPassengerRoutes === 'function') window.loadPassengerRoutes();

    setTimeout(() => {
      const list = document.getElementById('dynamic-passenger-routes');
      if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  async function openTripDetail(routeId) {
    goToRole('passenger');

    try {
      const res = await fetch(`/trips/${encodeURIComponent(routeId)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Puede que el viaje ya se llenó, venció o el conductor lo canceló
        showInfoToast(data.error || 'Este viaje ya no está disponible.');
        scrollToPassengerRoutes();
        return;
      }

      const origin = Array.isArray(data.originCoords) ? data.originCoords.map(Number) : [null, null];
      const dest = Array.isArray(data.destCoords) ? data.destCoords.map(Number) : [null, null];

      if (typeof window.openRouteModal === 'function') {
        window.openRouteModal(data.id, data.origin, data.dest, data.time, data.seats, origin[0], origin[1], dest[0], dest[1]);
      }
    } catch (error) {
      showInfoToast('No se pudo abrir el viaje. Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TARJETA "MI RUTA HABITUAL" (vista pasajero)
  // ─────────────────────────────────────────────────────────────
  function ensureHabitualSection() {
    let section = document.getElementById('habitual-routes');
    if (section) return section;

    const view = document.querySelector('#screen-passenger .passenger-view');
    if (!view) return null;

    section = document.createElement('section');
    section.id = 'habitual-routes';
    section.className = 'habitual';
    section.innerHTML = `
      <div class="habitual__header">
        <h3>Mi ruta habitual</h3>
        <span class="habitual__hint">Te avisamos cuando un conductor publique un viaje que coincida (hasta 2 km de diferencia).</span>
      </div>

      <form class="habitual__form" id="habitual-form" novalidate>
        <div class="habitual__field">
          <label class="form-label" for="h-origin">Origen</label>
          <div class="address-search">
            <input class="form-input" type="text" id="h-origin" placeholder="Ej.: Av. Primavera, Surco" autocomplete="off" />
            <div class="address-search-results" id="h-origin-results" hidden></div>
          </div>
        </div>

        <div class="habitual__field">
          <label class="form-label" for="h-dest">Destino</label>
          <div class="address-search">
            <input class="form-input" type="text" id="h-dest" placeholder="Ej.: Universidad de Lima" autocomplete="off" />
            <div class="address-search-results" id="h-dest-results" hidden></div>
          </div>
        </div>

        <div class="habitual__times">
          <span class="habitual__times-label">Horario <span class="habitual__optional">(opcional)</span></span>
          <div class="habitual__times-row">
            <label>Desde <input class="form-input" type="time" id="h-time-from" /></label>
            <label>Hasta <input class="form-input" type="time" id="h-time-to" /></label>
          </div>
        </div>

        <p class="habitual__message" id="habitual-message" hidden></p>

        <button type="submit" class="btn btn--primary btn--sm" id="habitual-submit">Guardar ruta habitual</button>
      </form>

      <ul class="habitual__list" id="habitual-list"></ul>
    `;
    view.appendChild(section);

    section.querySelector('#habitual-form').addEventListener('submit', (event) => {
      event.preventDefault();
      saveAlert();
    });

    section.querySelector('#habitual-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-action="delete-alert"]');
      if (button) removeAlert(button.dataset.id);
    });

    section.querySelector('#habitual-list').addEventListener('change', (event) => {
      const toggle = event.target.closest('[data-action="toggle-alert"]');
      if (toggle) toggleAlert(toggle.dataset.id, toggle.checked, toggle);
    });

    initAddressField('origin', 'h-origin', 'h-origin-results');
    initAddressField('dest', 'h-dest', 'h-dest-results');

    document.addEventListener('click', (event) => {
      if (!event.target.closest('#habitual-routes .address-search')) {
        section.querySelectorAll('.address-search-results').forEach(r => { r.hidden = true; });
      }
    });

    return section;
  }

  function showFormMessage(text, type = 'info') {
    const message = document.getElementById('habitual-message');
    if (!message) return;
    message.textContent = text;
    message.className = `habitual__message habitual__message--${type}`;
    message.hidden = !text;
  }

  async function loadAlerts() {
    ensureHabitualSection();

    try {
      const res = await fetch('/notifications/alerts');
      if (!res.ok) throw new Error();
      const data = await res.json();
      alerts = Array.isArray(data) ? data : [];
      renderAlerts();
    } catch (error) {
      const list = document.getElementById('habitual-list');
      if (list) list.innerHTML = '<li class="habitual__empty habitual__empty--error">No se pudieron cargar tus rutas habituales.</li>';
    }
  }

  function renderAlerts() {
    const list = document.getElementById('habitual-list');
    const submit = document.getElementById('habitual-submit');
    if (!list) return;

    if (submit) {
      submit.disabled = alerts.length >= MAX_ALERTS;
      submit.textContent = alerts.length >= MAX_ALERTS
        ? `Máximo ${MAX_ALERTS} rutas habituales`
        : 'Guardar ruta habitual';
    }

    if (alerts.length === 0) {
      list.innerHTML = '<li class="habitual__empty">Aún no tienes rutas habituales guardadas.</li>';
      return;
    }

    list.innerHTML = alerts.map(alert => {
      const schedule = alert.timeFrom && alert.timeTo
        ? `🕒 ${escapeText(alert.timeFrom)} – ${escapeText(alert.timeTo)}`
        : '🕒 Cualquier hora';

      return `
        <li class="habitual-item ${alert.active ? '' : 'habitual-item--paused'}">
          <div class="habitual-item__info">
            <div class="habitual-item__route" title="${escapeText(alert.origin)} → ${escapeText(alert.dest)}">
              ${escapeText(shortPlace(alert.origin))} → ${escapeText(shortPlace(alert.dest))}
            </div>
            <div class="habitual-item__meta">${schedule}${alert.active ? '' : ' · Alertas pausadas'}</div>
          </div>
          <div class="habitual-item__actions">
            <label class="habitual-switch">
              <input type="checkbox" data-action="toggle-alert" data-id="${escapeText(alert.id)}" ${alert.active ? 'checked' : ''} />
              <span class="habitual-switch__track"></span>
              <span class="habitual-switch__text">Recibir alertas</span>
            </label>
            <button type="button" class="habitual-item__delete" data-action="delete-alert" data-id="${escapeText(alert.id)}">Eliminar</button>
          </div>
        </li>
      `;
    }).join('');
  }

  async function saveAlert() {
    const timeFrom = document.getElementById('h-time-from').value;
    const timeTo = document.getElementById('h-time-to').value;

    if (!selected.origin) {
      showFormMessage('Selecciona el origen desde las sugerencias de dirección.', 'error');
      return;
    }
    if (!selected.dest) {
      showFormMessage('Selecciona el destino desde las sugerencias de dirección.', 'error');
      return;
    }
    if ((timeFrom && !timeTo) || (!timeFrom && timeTo)) {
      showFormMessage('Indica la hora de inicio y fin, o deja ambas vacías.', 'error');
      return;
    }

    const submit = document.getElementById('habitual-submit');
    submit.disabled = true;

    try {
      const res = await fetch('/notifications/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: selected.origin.name,
          originCoords: selected.origin.coords,
          dest: selected.dest.name,
          destCoords: selected.dest.coords,
          timeFrom,
          timeTo,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showFormMessage(data.error || 'No se pudo guardar tu ruta habitual.', 'error');
        return;
      }

      showFormMessage(data.message || 'Ruta habitual guardada.', 'success');
      resetForm();
      await loadAlerts();
      if (data.matchesFound > 0) loadNotifications();
    } catch (error) {
      showFormMessage('No hay conexión con el servidor. Inténtalo de nuevo.', 'error');
    } finally {
      submit.disabled = alerts.length >= MAX_ALERTS;
    }
  }

  function resetForm() {
    ['h-origin', 'h-dest', 'h-time-from', 'h-time-to'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    selected.origin = null;
    selected.dest = null;
  }

  async function toggleAlert(id, active, input) {
    try {
      const res = await fetch(`/notifications/alerts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);

      const alert = alerts.find(a => a.id === id);
      if (alert) alert.active = data.alert ? data.alert.active : active;
      renderAlerts();
      showFormMessage(data.message, 'info');
    } catch (error) {
      input.checked = !active;
      showFormMessage(error.message || 'No se pudo actualizar la ruta habitual.', 'error');
    }
  }

  async function removeAlert(id) {
    try {
      const res = await fetch(`/notifications/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);

      alerts = alerts.filter(a => a.id !== id);
      renderAlerts();
      showFormMessage(data.message || 'Ruta habitual eliminada.', 'info');
    } catch (error) {
      showFormMessage(error.message || 'No se pudo eliminar la ruta habitual.', 'error');
    }
  }

  // Búsqueda de direcciones propia (addressSearch.js está atado al formulario del conductor)
  function initAddressField(type, inputId, resultsId) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    let timer = null;
    let controller = null;

    input.addEventListener('input', () => {
      selected[type] = null;
      clearTimeout(timer);

      const query = input.value.trim();
      if (query.length < MIN_QUERY_LENGTH) {
        results.innerHTML = '';
        results.hidden = true;
        return;
      }

      timer = setTimeout(async () => {
        if (controller) controller.abort();
        controller = new AbortController();

        results.innerHTML = '<div class="address-search-empty">Buscando direcciones...</div>';
        results.hidden = false;

        try {
          const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2'
            + `&q=${encodeURIComponent(query)}`
            + '&countrycodes=pe&viewbox=-77.20,-12.25,-76.75,-11.80&bounded=1&limit=6';
          const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error();
          const places = await res.json();

          if (!Array.isArray(places) || places.length === 0) {
            results.innerHTML = '<div class="address-search-empty">No se encontraron direcciones. Intenta ser más específico.</div>';
            return;
          }

          results.innerHTML = places.map((place, index) => `
            <button type="button" class="address-search-item" data-index="${index}">
              <span class="address-search-item__icon">📍</span>
              <span class="address-search-item__text">${escapeText(place.display_name)}</span>
            </button>
          `).join('');

          results.querySelectorAll('.address-search-item').forEach(button => {
            button.addEventListener('click', () => {
              const place = places[Number(button.dataset.index)];
              const lat = Number(place?.lat);
              const lng = Number(place?.lon);
              if (!place || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

              selected[type] = { name: place.display_name, coords: [lat, lng] };
              input.value = place.display_name;
              results.innerHTML = '';
              results.hidden = true;
            });
          });
        } catch (error) {
          if (error.name === 'AbortError') return;
          results.innerHTML = '<div class="address-search-empty address-search-empty--error">No se pudo buscar la dirección.</div>';
        }
      }, SEARCH_DELAY_MS);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // CONEXIÓN CON EL DASHBOARD
  // ─────────────────────────────────────────────────────────────
  // Igual que en US24: se envuelve la función del dashboard sin modificar dashboard.js
  function wrapGlobal(name, after) {
    const original = window[name];
    if (typeof original !== 'function') return;

    window[name] = function (...args) {
      const result = original.apply(this, args);
      try { after(); } catch (error) { console.error(`[Notificaciones] ${name}:`, error); }
      return result;
    };
  }

  wrapGlobal('loadPassengerRoutes', () => loadAlerts());

  ensureBell();
  startPolling();

  window.loadNotifications = loadNotifications;
})();
