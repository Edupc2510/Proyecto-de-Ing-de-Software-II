// public/js/tripHistory.js
// US23 - Pantalla "Mis viajes": historial de viajes del pasajero con filtro por fecha.
//
// Uso: TripHistory.open() abre la ventana, TripHistory.refresh() recarga la lista.

const TripHistory = (() => {
  const MODAL_ID = 'trip-history-modal';

  const STATUS_LABELS = {
    realizado: { text: 'Realizado', color: '#16a34a' },
    proximo: { text: 'Pr\u00f3ximo', color: '#2563eb' },
    cancelado: { text: 'Cancelado', color: '#dc2626' },
  };

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDate(dateKey) {
    if (!dateKey) return 'Sin fecha';
    const [year, month, day] = dateKey.split('-');
    return `${day}/${month}/${year}`;
  }

  // Crea la ventana la primera vez que se abre (no modifica el HTML existente)
  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="driver-form-card" style="width: 100%; max-width: 560px; margin: auto; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="driver-form-card__header" style="justify-content: space-between; align-items: center;">
          <span>Mis viajes</span>
          <button type="button" data-action="close" style="background: transparent; border: none; color: white; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div class="driver-form-body" style="overflow-y: auto;">
          <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: flex-end; margin-bottom: var(--space-sm); font-family: 'DM Sans', sans-serif;">
            <label style="flex: 1; min-width: 130px;">Desde<br><input type="date" id="trip-history-from" style="width: 100%;"></label>
            <label style="flex: 1; min-width: 130px;">Hasta<br><input type="date" id="trip-history-to" style="width: 100%;"></label>
            <button type="button" class="btn btn--primary btn--sm" data-action="filter">Filtrar</button>
            <button type="button" class="btn btn--ghost btn--sm" data-action="clear">Limpiar</button>
          </div>
          <div id="trip-history-list" style="font-family: 'DM Sans', sans-serif;"></div>
        </div>
      </div>`;

    modal.addEventListener('click', (event) => {
      const action = event.target?.dataset?.action;
      if (event.target === modal || action === 'close') close();
      if (action === 'filter') refresh();
      if (action === 'retry') refresh();
      // US29: guardar o quitar el conductor de favoritos
      if (action === 'favorite' && window.FavoriteDrivers) {
        FavoriteDrivers.toggle(event.target.dataset.driverId, event.target);
      }
      if (action === 'clear') {
        document.getElementById('trip-history-from').value = '';
        document.getElementById('trip-history-to').value = '';
        refresh();
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function setListContent(html) {
    const list = document.getElementById('trip-history-list');
    if (list) list.innerHTML = html;
  }

  function renderMessage(text, withRetry = false) {
    setListContent(`
      <div style="text-align: center; padding: var(--space-md) 0; opacity: 0.8;">
        <p>${escapeText(text)}</p>
        ${withRetry ? '<button type="button" class="btn btn--ghost btn--sm" data-action="retry">Reintentar</button>' : ''}
      </div>`);
  }

  function renderTrips(trips) {
    const cards = trips.map((trip) => {
      const status = STATUS_LABELS[trip.status] || { text: trip.status, color: '#6b7280' };
      const pickup = trip.pickupPoint?.address
        ? `<p style="margin: 2px 0;">&#128587; Recojo: ${escapeText(trip.pickupPoint.address)}</p>`
        : '';

      // US29 - Escenarios 01 y 04: guardar al conductor de un viaje terminado
      const canSave = trip.status === 'realizado' && trip.driverId && window.FavoriteDrivers;
      const saved = canSave && FavoriteDrivers.isSaved(trip.driverId);
      const favoriteButton = canSave
        ? `<button type="button" class="btn btn--ghost btn--sm" style="margin-top: var(--space-xs);" data-action="favorite" data-driver-id="${escapeText(trip.driverId)}">${saved ? '\u2605 Favorito' : '\u2606 Guardar en Favoritos'}</button>`
        : '';

      return `
        <div style="border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; padding: var(--space-sm); margin-bottom: var(--space-xs);">
          <div style="display: flex; justify-content: space-between; gap: var(--space-xs);">
            <strong>${escapeText(formatDate(trip.date))}${trip.time ? ' \u00b7 ' + escapeText(trip.time) : ''}</strong>
            <span style="color: ${status.color}; font-weight: 600;">${escapeText(status.text)}</span>
          </div>
          <p style="margin: 2px 0;">&#128205; ${escapeText(trip.origin)}</p>
          <p style="margin: 2px 0;">&#127937; ${escapeText(trip.dest)}</p>
          ${pickup}
          ${favoriteButton}
        </div>`;
    });

    setListContent(cards.join(''));
  }

  // US23 - Escenarios 01 a 05: cargar, filtrar y mostrar el historial
  async function refresh() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.style.display === 'none') return;

    const from = document.getElementById('trip-history-from').value;
    const to = document.getElementById('trip-history-to').value;

    if (from && to && from > to) {
      renderMessage('La fecha "Desde" no puede ser posterior a la fecha "Hasta".');
      return;
    }

    renderMessage('Cargando tu historial...');

    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`/trips/history?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Escenario 04: error del servidor
        renderMessage(data.error || 'No se pudo cargar tu historial de viajes.', true);
        return;
      }

      const trips = Array.isArray(data.trips) ? data.trips : [];

      if (trips.length === 0) {
        // Escenario 02: sin viajes (o sin resultados para el filtro)
        renderMessage(from || to
          ? 'No tienes viajes en ese rango de fechas.'
          : 'A\u00fan no tienes viajes. Cuando reserves uno, aparecer\u00e1 aqu\u00ed.');
        return;
      }

      // US29: saber que conductores ya estan guardados
      if (window.FavoriteDrivers) await FavoriteDrivers.loadIds();

      renderTrips(trips);
    } catch (error) {
      console.error('[TripHistory] Error al cargar el historial:', error);
      renderMessage('Error de conexi\u00f3n al cargar tu historial.', true);
    }
  }

  function open() {
    const modal = ensureModal();
    modal.style.display = 'flex';
    refresh();
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.style.display = 'none';
  }

  return { open, close, refresh };
})();

window.TripHistory = TripHistory;
