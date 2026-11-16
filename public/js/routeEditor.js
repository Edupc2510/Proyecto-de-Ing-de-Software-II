// public/js/routeEditor.js
// US33 - Editar ruta publicada (vista del conductor).
//
// Escenarios:
//   01 Edicion de horario sin reservas -> se guarda y se actualiza la tarjeta
//   02 Bloqueo por tiempo limite       -> a menos de 30 min no se abre el formulario
//   03 Edicion con reservas activas    -> el servidor avisa a los pasajeros
//   04 Reduccion de asientos           -> no se puede bajar de los asientos ocupados
//   05 Descarte de edicion             -> "Atras" con cambios pregunta "Descartar cambios?"
//
// Reutiliza el diseno de los modales del conductor (driverRequests.css y routeCancel.css).

(() => {
  const MAX_SEATS = 4;

  let currentRoute = null;
  let initialValues = null;
  let isSubmitting = false;

  const shortPlace = (text) => String(text || '').split(',')[0].trim();

  function ensureModal() {
    let overlay = document.getElementById('edit-route-modal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'edit-route-modal';
    overlay.className = 'requests-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="requests-modal" role="dialog" aria-modal="true" aria-labelledby="edit-route-title">
        <div class="requests-modal__header">
          <div>
            <h2 id="edit-route-title">Editar viaje</h2>
            <p id="edit-route-summary">--</p>
          </div>
          <button type="button" class="requests-modal__close" data-action="back" aria-label="Cerrar">&times;</button>
        </div>

        <div class="requests-modal__body">
          <label class="cancel-field" for="edit-route-time">
            <span>Hora de salida</span>
            <input id="edit-route-time" type="time" required />
          </label>

          <label class="cancel-field" for="edit-route-seats">
            <span>Capacidad total del veh\u00edculo <span id="edit-route-occupied" class="cancel-field__optional"></span></span>
            <select id="edit-route-seats"></select>
          </label>

          <label class="cancel-field" for="edit-route-notes">
            <span>Detalles de la ruta <span class="cancel-field__optional">(avenidas, referencias)</span></span>
            <textarea id="edit-route-notes" maxlength="500" rows="2" placeholder="Hasta 500 caracteres; se avisa a los pasajeros"></textarea>
          </label>

          <div id="edit-route-error" class="form-message form-message--error" style="display:none;"></div>

          <div class="cancel-actions">
            <button type="button" class="btn btn--ghost" data-action="back">&larr; Atr\u00e1s</button>
            <button type="button" id="edit-route-submit" class="btn btn--primary" data-action="save">Guardar cambios</button>
          </div>
        </div>
      </div>`;

    overlay.addEventListener('click', (event) => {
      const action = event.target?.dataset?.action;
      if (event.target === overlay || action === 'back') tryClose();
      if (action === 'save') save();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) tryClose();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function getFormValues() {
    return {
      time: document.getElementById('edit-route-time').value,
      totalSeats: Number(document.getElementById('edit-route-seats').value),
      notes: document.getElementById('edit-route-notes').value.trim(),
    };
  }

  function hasChanges() {
    if (!initialValues) return false;
    const now = getFormValues();
    return now.time !== initialValues.time ||
      now.totalSeats !== initialValues.totalSeats ||
      now.notes !== initialValues.notes;
  }

  function showError(message) {
    const box = document.getElementById('edit-route-error');
    if (!box) return;
    box.textContent = message || '';
    box.style.display = message ? 'block' : 'none';
  }

  function close() {
    const overlay = document.getElementById('edit-route-modal');
    if (overlay) overlay.hidden = true;
    currentRoute = null;
    initialValues = null;
  }

  // US33 - Escenario 05: confirmar antes de perder cambios
  function tryClose() {
    if (hasChanges() && !confirm('\u00bfDescartar cambios?')) return;
    close();
  }

  // US33 - Escenario 02: el servidor bloquea si faltan menos de 30 minutos
  async function openEditRouteModal(routeId) {
    try {
      const res = await fetch(`/trips/${encodeURIComponent(routeId)}/edit`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'No se pudo abrir la edici\u00f3n de la ruta.');
        return;
      }

      const overlay = ensureModal();
      const { route, capacity } = data;
      currentRoute = route;

      document.getElementById('edit-route-summary').textContent =
        `${shortPlace(route.origin)} \u2192 ${shortPlace(route.dest)}`;
      document.getElementById('edit-route-time').value = route.time;
      document.getElementById('edit-route-notes').value = route.notes || '';

      // US33 - Escenario 04: no se ofrece una capacidad menor a los asientos ocupados
      const minSeats = Math.max(1, capacity.occupied);
      const select = document.getElementById('edit-route-seats');
      select.innerHTML = '';
      for (let n = minSeats; n <= MAX_SEATS; n++) {
        const free = n - capacity.occupied;
        const option = document.createElement('option');
        option.value = String(n);
        option.textContent = `${n} asiento${n !== 1 ? 's' : ''} (${free} libre${free !== 1 ? 's' : ''})`;
        select.appendChild(option);
      }
      select.value = String(Math.min(MAX_SEATS, Math.max(minSeats, capacity.total)));

      document.getElementById('edit-route-occupied').textContent = capacity.occupied > 0
        ? `(${capacity.occupied} ya reservado${capacity.occupied !== 1 ? 's' : ''})`
        : '(sin reservas)';

      initialValues = getFormValues();
      showError('');
      overlay.hidden = false;
    } catch (error) {
      console.error('[RouteEditor] Error al abrir la edicion:', error);
      alert('Error de conexi\u00f3n al abrir la edici\u00f3n de la ruta.');
    }
  }

  // US33 - Escenarios 01, 03 y 04: guardar cambios
  async function save() {
    if (!currentRoute || isSubmitting) return;

    if (!hasChanges()) {
      showError('No hiciste ning\u00fan cambio.');
      return;
    }

    const values = getFormValues();
    const changes = {};
    if (values.time !== initialValues.time) changes.time = values.time;
    if (values.totalSeats !== initialValues.totalSeats) changes.totalSeats = values.totalSeats;
    if (values.notes !== initialValues.notes) changes.notes = values.notes;

    const button = document.getElementById('edit-route-submit');
    isSubmitting = true;
    button.disabled = true;
    showError('');

    try {
      const res = await fetch(`/trips/${encodeURIComponent(currentRoute.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showError(data.error || 'No se pudo guardar la ruta.');
        return;
      }

      close();
      alert(data.message || 'Ruta actualizada correctamente.');

      if (typeof window.onRouteEdited === 'function') {
        await window.onRouteEdited(data.route);
      }
    } catch (error) {
      console.error('[RouteEditor] Error al guardar:', error);
      showError('Error de conexi\u00f3n al guardar los cambios.');
    } finally {
      isSubmitting = false;
      button.disabled = false;
    }
  }

  window.openEditRouteModal = openEditRouteModal;
})();
