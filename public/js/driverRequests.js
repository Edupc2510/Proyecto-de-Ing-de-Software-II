// public/js/driverRequests.js
// US14 - Visualizar solicitudes de viaje (vista del conductor).
//
// Abre una ventana con los pasajeros que reservaron en una ruta publicada.
// Escenarios de la guía:
//   01 Ver solicitudes        → lista con los pasajeros
//   02 Sin solicitudes        → mensaje de lista vacía
//   03 Nueva solicitud        → la lista se actualiza sola cada 15 s y resalta las nuevas
//   04 Error de carga         → mensaje de error con botón "Reintentar"
//   05 Visualización correcta → nombre, correo, punto de recojo, estado y hora
//
// El modal se crea con JavaScript la primera vez que se abre, para no tener
// que modificar dashboard.html (solo se agrega el <script> y el <link>).

(() => {
  const AUTO_REFRESH_MS = 15000;

  let currentRouteId = null;
  let refreshTimer = null;
  let knownRequestIds = new Set();
  let hasLoadedOnce = false;
  let isLoading = false;

  const STATUS_LABELS = {
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
  };

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function formatTime(isoDate) {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  const shortPlace = (text) => String(text || '').split(',')[0].trim();

  // ─────────────────────────────────────────────────────────────
  // ESTRUCTURA DEL MODAL
  // ─────────────────────────────────────────────────────────────
  function ensureModal() {
    let overlay = document.getElementById('requests-modal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'requests-modal';
    overlay.className = 'requests-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="requests-modal" role="dialog" aria-modal="true" aria-labelledby="requests-modal-title">
        <div class="requests-modal__header">
          <div>
            <h2 id="requests-modal-title">Solicitudes de viaje</h2>
            <p id="requests-modal-route">--</p>
          </div>
          <button type="button" class="requests-modal__close" data-action="close" aria-label="Cerrar">×</button>
        </div>

        <div class="requests-modal__toolbar">
          <span id="requests-modal-summary" class="requests-modal__summary"></span>
          <button type="button" class="requests-modal__refresh" data-action="refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Actualizar
          </button>
        </div>

        <div id="requests-modal-body" class="requests-modal__body"></div>

        <p class="requests-modal__hint">La lista se actualiza automáticamente cada 15 segundos.</p>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeRequestsModal();

      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'close') closeRequestsModal();
      if (action === 'refresh') loadRequests({ manual: true });
      if (action === 'retry') loadRequests({ manual: true });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeRequestsModal();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  function renderLoading() {
    document.getElementById('requests-modal-body').innerHTML = `
      <div class="requests-state">
        <div class="spinner"></div>
        <p>Cargando solicitudes...</p>
      </div>
    `;
  }

  function renderError(message) {
    const routeLabel = document.getElementById('requests-modal-route');
    if (routeLabel.textContent === 'Cargando ruta...') {
      routeLabel.textContent = 'No se pudo cargar la ruta';
    }
    document.getElementById('requests-modal-summary').textContent = '';
    document.getElementById('requests-modal-body').innerHTML = `
      <div class="requests-state requests-state--error">
        <p>⚠️ ${escapeText(message)}</p>
        <button type="button" class="btn btn--ghost btn--sm" data-action="retry">Reintentar</button>
      </div>
    `;
  }

  function renderRequests(data, newIds) {
    const { route, requests, confirmedCount } = data;

    document.getElementById('requests-modal-route').textContent =
      `${shortPlace(route.origin)} → ${shortPlace(route.dest)} · ${route.time}`;

    const seatsText = Number(route.seats) === 0
      ? 'Ruta llena'
      : `${route.seats} asiento${Number(route.seats) === 1 ? '' : 's'} libre${Number(route.seats) === 1 ? '' : 's'}`;

    document.getElementById('requests-modal-summary').textContent =
      `${confirmedCount} pasajero${confirmedCount === 1 ? '' : 's'} confirmado${confirmedCount === 1 ? '' : 's'} · ${seatsText}`;

    const body = document.getElementById('requests-modal-body');

    // Escenario 02: sin solicitudes
    if (!Array.isArray(requests) || requests.length === 0) {
      body.innerHTML = `
        <div class="requests-state">
          <div class="requests-state__icon">🧍</div>
          <p><strong>Aún no tienes solicitudes para esta ruta.</strong></p>
          <p class="requests-state__sub">Cuando un pasajero reserve un asiento aparecerá aquí.</p>
        </div>
      `;
      return;
    }

    // Escenarios 01 y 05: lista con los datos de cada pasajero
    body.innerHTML = `
      <ul class="requests-list">
        ${requests.map(request => {
          const initial = (request.passengerName || 'P').charAt(0).toUpperCase();
          const statusLabel = STATUS_LABELS[request.status] || request.status;
          const isNew = newIds.has(request.id);

          return `
            <li class="request-item ${isNew ? 'request-item--new' : ''} ${request.status === 'cancelada' ? 'request-item--cancelled' : ''}">
              <div class="request-item__avatar">${escapeText(initial)}</div>
              <div class="request-item__info">
                <div class="request-item__name">
                  ${escapeText(request.passengerName)}
                  ${isNew ? '<span class="request-item__new-badge">Nueva</span>' : ''}
                </div>
                ${request.passengerEmail ? `<div class="request-item__meta">✉️ ${escapeText(request.passengerEmail)}</div>` : ''}
                ${request.pickupAddress ? `<div class="request-item__meta">📍 Recojo: ${escapeText(shortPlace(request.pickupAddress))}</div>` : ''}
                <div class="request-item__meta">🕒 Reservó a las ${escapeText(formatTime(request.requestedAt))}</div>
              </div>
              <span class="request-status request-status--${escapeText(request.status)}">${escapeText(statusLabel)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  // ─────────────────────────────────────────────────────────────
  // CARGA DE DATOS
  // ─────────────────────────────────────────────────────────────
  async function loadRequests({ silent = false } = {}) {
    if (!currentRouteId || isLoading) return;

    const routeIdAtStart = currentRouteId;
    isLoading = true;

    if (!silent) renderLoading();

    try {
      const res = await fetch(`/trips/${encodeURIComponent(routeIdAtStart)}/requests`);
      const data = await res.json().catch(() => ({}));

      // Si el conductor cerró o cambió de ruta mientras cargaba, ignoramos la respuesta
      if (routeIdAtStart !== currentRouteId) return;

      if (!res.ok) {
        renderError(data.error || 'No se pudieron cargar las solicitudes.');
        return;
      }

      // Escenario 03: detectar solicitudes que llegaron desde la última carga
      // (en la primera carga no se marca nada como "Nueva")
      const ids = (data.requests || []).map(r => r.id);
      const newIds = hasLoadedOnce
        ? new Set(ids.filter(id => !knownRequestIds.has(id)))
        : new Set();

      knownRequestIds = new Set(ids);
      hasLoadedOnce = true;
      renderRequests(data, newIds);

      // Si llegaron solicitudes nuevas, actualizar también el contador de la tarjeta
      if (newIds.size > 0 && typeof window.loadDriverPublishedRoutes === 'function') {
        window.loadDriverPublishedRoutes();
      }

    } catch (error) {
      // Escenario 04: error de carga (por ejemplo, sin conexión)
      console.error('[US14] Error cargando solicitudes:', error);
      if (routeIdAtStart === currentRouteId) {
        renderError('No se pudo conectar con el servidor. Revisa tu conexión.');
      }
    } finally {
      isLoading = false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ABRIR / CERRAR
  // ─────────────────────────────────────────────────────────────
  function openRequestsModal(routeId) {
    if (!routeId) return;

    const overlay = ensureModal();

    currentRouteId = String(routeId);
    knownRequestIds = new Set();
    hasLoadedOnce = false;
    document.getElementById('requests-modal-route').textContent = 'Cargando ruta...';
    document.getElementById('requests-modal-summary').textContent = '';

    overlay.hidden = false;
    loadRequests();

    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => loadRequests({ silent: true }), AUTO_REFRESH_MS);
  }

  function closeRequestsModal() {
    const overlay = document.getElementById('requests-modal');
    if (overlay) overlay.hidden = true;

    clearInterval(refreshTimer);
    refreshTimer = null;
    currentRouteId = null;

    // Al cerrar, refrescamos los contadores de "Ver solicitudes (N)"
    if (typeof window.loadDriverPublishedRoutes === 'function') {
      window.loadDriverPublishedRoutes();
    }
  }

  window.openRequestsModal = openRequestsModal;
  window.closeRequestsModal = closeRequestsModal;
})();
