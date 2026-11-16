// public/js/routeCancel.js
// US34 - Cancelar ruta publicada (vista del conductor).
//
// Escenarios de la guía:
//   01 Cancelación sin pasajeros   → la ruta pasa a CANCELADA y sale de la búsqueda
//   02 Cancelación con reservas    → se avisa cuántos pasajeros serán liberados y notificados
//   03 Confirmación de seguridad   → modal que exige escribir "CANCELAR"
//   04 Cancelación tardía          → aviso si faltan menos de 15 min y hay pasajeros (strike)
//   05 Intento de reactivación     → la ruta cancelada no se reabre; el botón "Publicar de nuevo"
//                                    muestra el aviso y llena el formulario para publicar una ruta nueva
//
// La ventana reutiliza el diseño del modal de solicitudes (driverRequests.css).

(() => {
  const CONFIRM_WORD = 'CANCELAR';
  const LATE_CANCELLATION_MINUTES = 15;
  const MAX_REASON_LENGTH = 200;

  let routeToCancel = null;
  let cancelledRoutes = [];
  let isSubmitting = false;

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  const shortPlace = (text) => String(text || '').split(',')[0].trim();

  function minutesUntilDeparture(route) {
    const departure = Number(route?.expiresAtTimestamp);
    if (!Number.isFinite(departure) || departure <= 0) return null;
    return Math.floor((departure - Date.now()) / 60000);
  }

  // ─────────────────────────────────────────────────────────────
  // MODAL DE CONFIRMACIÓN (Escenario 03)
  // ─────────────────────────────────────────────────────────────
  function ensureModal() {
    let overlay = document.getElementById('cancel-route-modal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'cancel-route-modal';
    overlay.className = 'requests-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="requests-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-route-title">
        <div class="requests-modal__header cancel-modal__header">
          <div>
            <h2 id="cancel-route-title">Cancelar viaje</h2>
            <p id="cancel-route-summary">--</p>
          </div>
          <button type="button" class="requests-modal__close" data-action="close" aria-label="Cerrar">×</button>
        </div>

        <div class="requests-modal__body cancel-modal__body">
          <div id="cancel-route-impact" class="cancel-impact"></div>
          <div id="cancel-route-late" class="cancel-late" hidden></div>

          <label class="cancel-field" for="cancel-route-reason">
            <span>Motivo <span class="cancel-field__optional">(opcional, se enviará a los pasajeros)</span></span>
            <textarea id="cancel-route-reason" maxlength="${MAX_REASON_LENGTH}" rows="2"
              placeholder="Ej: Se malogró el auto"></textarea>
          </label>

          <label class="cancel-field" for="cancel-route-confirm">
            <span>Para confirmar, escribe <strong>${CONFIRM_WORD}</strong></span>
            <input id="cancel-route-confirm" type="text" autocomplete="off" spellcheck="false"
              placeholder="${CONFIRM_WORD}" />
          </label>

          <div id="cancel-route-error" class="form-message form-message--error" style="display:none;"></div>

          <div class="cancel-actions">
            <button type="button" class="btn btn--ghost" data-action="close">Volver</button>
            <button type="button" id="cancel-route-submit" class="btn cancel-btn-danger" disabled>Cancelar viaje</button>
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeCancelRouteModal();
      if (event.target.closest('[data-action="close"]')) closeCancelRouteModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeCancelRouteModal();
    });

    document.body.appendChild(overlay);

    // El botón rojo solo se habilita cuando se escribe exactamente "CANCELAR"
    const confirmInput = overlay.querySelector('#cancel-route-confirm');
    const submitButton = overlay.querySelector('#cancel-route-submit');

    confirmInput.addEventListener('input', () => {
      // El campo se ve en mayúsculas, así que convertimos lo escrito para que coincida
      const caret = confirmInput.selectionStart;
      confirmInput.value = confirmInput.value.toUpperCase();
      confirmInput.setSelectionRange(caret, caret);

      submitButton.disabled = confirmInput.value.trim() !== CONFIRM_WORD || isSubmitting;
    });

    confirmInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !submitButton.disabled) submitCancellation();
    });

    submitButton.addEventListener('click', submitCancellation);

    return overlay;
  }

  function showError(message) {
    const errorEl = document.getElementById('cancel-route-error');
    errorEl.textContent = `⚠️ ${message}`;
    errorEl.style.display = 'flex';
  }

  function openCancelRouteModal(route) {
    if (!route) return;

    const overlay = ensureModal();
    routeToCancel = route;
    isSubmitting = false;

    const passengers = Number(route.requestsCount) || 0;
    const minutesLeft = minutesUntilDeparture(route);

    document.getElementById('cancel-route-summary').textContent =
      `${shortPlace(route.origin)} → ${shortPlace(route.dest)} · ${route.time}`;

    // Escenarios 01 y 02: qué pasará con los pasajeros
    document.getElementById('cancel-route-impact').innerHTML = passengers > 0
      ? `<strong>Este viaje tiene ${passengers} pasajero${passengers === 1 ? '' : 's'} con reserva.</strong>
         Sus reservas quedarán canceladas y recibirán una notificación de prioridad alta.`
      : `<strong>Este viaje no tiene pasajeros.</strong>
         Dejará de aparecer en la búsqueda de rutas.`;

    // Escenario 04: aviso de cancelación tardía
    const lateEl = document.getElementById('cancel-route-late');
    const isLate = passengers > 0 && minutesLeft !== null && minutesLeft < LATE_CANCELLATION_MINUTES;
    lateEl.hidden = !isLate;
    lateEl.innerHTML = isLate
      ? `⏰ Faltan menos de ${LATE_CANCELLATION_MINUTES} minutos para la salida. Cancelar ahora quedará registrado en tu historial de fiabilidad como conductor.`
      : '';

    document.getElementById('cancel-route-reason').value = '';
    document.getElementById('cancel-route-confirm').value = '';
    document.getElementById('cancel-route-error').style.display = 'none';

    const submitButton = document.getElementById('cancel-route-submit');
    submitButton.disabled = true;
    submitButton.textContent = 'Cancelar viaje';

    overlay.hidden = false;
    setTimeout(() => document.getElementById('cancel-route-confirm').focus(), 50);
  }

  function closeCancelRouteModal() {
    const overlay = document.getElementById('cancel-route-modal');
    if (overlay) overlay.hidden = true;
    routeToCancel = null;
  }

  async function submitCancellation() {
    if (!routeToCancel || isSubmitting) return;

    const confirmation = document.getElementById('cancel-route-confirm').value.trim();
    const reason = document.getElementById('cancel-route-reason').value.trim().slice(0, MAX_REASON_LENGTH);
    const submitButton = document.getElementById('cancel-route-submit');

    if (confirmation !== CONFIRM_WORD) {
      showError(`Debes escribir exactamente la palabra ${CONFIRM_WORD}.`);
      return;
    }

    const routeId = routeToCancel.id;
    isSubmitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Cancelando...';

    try {
      const res = await fetch(`/trips/${encodeURIComponent(routeId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, reason })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data.error || 'No se pudo cancelar la ruta.');
        return;
      }

      closeCancelRouteModal();

      if (typeof window.onRouteCancelled === 'function') {
        window.onRouteCancelled(routeId, data);
      }

      loadCancelledRoutes();
      alert(`✅ ${data.message || 'Ruta cancelada correctamente.'}`);

    } catch (error) {
      console.error('[US34] Error cancelando ruta:', error);
      showError('No se pudo conectar con el servidor. Revisa tu conexión.');
    } finally {
      isSubmitting = false;
      if (!document.getElementById('cancel-route-modal').hidden) {
        submitButton.textContent = 'Cancelar viaje';
        submitButton.disabled =
          document.getElementById('cancel-route-confirm').value.trim() !== CONFIRM_WORD;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HISTORIAL DE RUTAS CANCELADAS (Escenario 05)
  // ─────────────────────────────────────────────────────────────
  function ensureHistoryContainer() {
    let container = document.getElementById('cancelled-routes');
    if (container) return container;

    const published = document.getElementById('published-routes');
    if (!published) return null;

    container = document.createElement('div');
    container.id = 'cancelled-routes';
    container.className = 'cancelled-routes';
    published.insertAdjacentElement('afterend', container);

    container.addEventListener('click', async (event) => {
      const button = event.target.closest('.cancelled-route__republish');
      if (button) await republishRoute(button);
    });

    return container;
  }

  function formatDateTime(isoDate) {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  async function loadCancelledRoutes() {
    const container = ensureHistoryContainer();
    if (!container) return;

    try {
      const res = await fetch('/trips/mine/cancelled');
      const routes = await res.json().catch(() => []);

      if (!res.ok || !Array.isArray(routes) || routes.length === 0) {
        cancelledRoutes = [];
        container.innerHTML = '';
        return;
      }

      cancelledRoutes = routes;

      // Se muestra plegado para no ocupar espacio en la vista del conductor
      const wasOpen = container.querySelector('details')?.open ?? false;

      container.innerHTML = `
        <details class="cancelled-routes__panel" ${wasOpen ? 'open' : ''}>
          <summary>Rutas canceladas (${routes.length})</summary>
          <ul class="cancelled-routes__list">
            ${routes.map(route => `
              <li class="cancelled-route">
                <div class="cancelled-route__info">
                  <div class="cancelled-route__title">
                    ${escapeText(shortPlace(route.origin))} → ${escapeText(shortPlace(route.dest))} · ${escapeText(route.time)}
                  </div>
                  <div class="cancelled-route__meta">
                    Cancelada el ${escapeText(formatDateTime(route.cancelledAt))}
                    ${route.cancelReason ? ` · Motivo: ${escapeText(route.cancelReason)}` : ''}
                  </div>
                  <div class="cancelled-route__message" hidden></div>
                </div>
                <div class="cancelled-route__actions">
                  <span class="request-status request-status--cancelada">Cancelada</span>
                  <button type="button" class="cancelled-route__republish" data-route-id="${escapeText(route.id)}">
                    Publicar de nuevo
                  </button>
                </div>
              </li>
            `).join('')}
          </ul>
        </details>
      `;
    } catch (error) {
      console.error('[US34] Error cargando rutas canceladas:', error);
    }
  }

  // Escenario 05: un viaje cancelado no se puede reabrir (el servidor siempre lo rechaza).
  // En lugar de un botón que solo falla, "Publicar de nuevo" muestra ese aviso y
  // llena el formulario de "Publicar ruta" con los mismos datos para crear una ruta NUEVA.
  async function republishRoute(button) {
    const item = button.closest('.cancelled-route');
    const messageEl = item.querySelector('.cancelled-route__message');
    const route = cancelledRoutes.find(r => String(r.id) === button.dataset.routeId);

    button.disabled = true;

    let serverMessage = 'Los viajes cancelados no pueden reabrirse. Por favor, publica una nueva ruta.';
    try {
      const res = await fetch(`/trips/${encodeURIComponent(button.dataset.routeId)}/reactivate`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      serverMessage = data.error || data.message || serverMessage;
    } catch (error) {
      // Sin conexión igual se puede preparar el formulario; se publica cuando vuelva la conexión
    }

    const filled = route ? fillPublishForm(route) : false;

    messageEl.textContent = filled
      ? `${serverMessage} Ya llenamos el formulario con esta ruta: elige la nueva hora de salida y publícala.`
      : serverMessage;
    messageEl.hidden = false;
    button.disabled = false;
  }

  function fillPublishForm(route) {
    const origin = Array.isArray(route.originCoords) ? route.originCoords : [];
    const dest = Array.isArray(route.destCoords) ? route.destCoords : [];

    const originOk = typeof window.setDriverOriginLocation === 'function'
      && window.setDriverOriginLocation(route.origin, origin[0], origin[1]);
    const destOk = typeof window.setDriverDestinationLocation === 'function'
      && window.setDriverDestinationLocation(route.dest, dest[0], dest[1]);

    if (!originOk || !destOk) return false;

    const seats = document.getElementById('d-seats');
    if (seats && [...seats.options].some(o => o.value === String(route.seats))) {
      seats.value = String(route.seats);
    }

    const notes = document.getElementById('d-notes');
    if (notes) notes.value = route.notes || '';

    // La hora se deja vacía a propósito: es un viaje nuevo
    const time = document.getElementById('d-time');
    if (time) {
      time.value = '';
      time.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => time.focus({ preventScroll: true }), 400);
    }

    return true;
  }

  window.openCancelRouteModal = openCancelRouteModal;
  window.closeCancelRouteModal = closeCancelRouteModal;
  window.loadCancelledRoutes = loadCancelledRoutes;
})();
