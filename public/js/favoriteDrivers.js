// public/js/favoriteDrivers.js
// US29 - Pantalla "Conductores Frecuentes" del pasajero y boton de favoritos.
//
// Uso:
//   FavoriteDrivers.open()                 -> abre la lista de conductores guardados
//   FavoriteDrivers.toggle(driverId, btn)  -> guarda o elimina un conductor (icono estrella)
//   FavoriteDrivers.isSaved(driverId)      -> true si el conductor ya esta guardado
//   FavoriteDrivers.loadIds()              -> recarga los IDs guardados

const FavoriteDrivers = (() => {
  const MODAL_ID = 'favorite-drivers-modal';
  const EMPTY_TEXT = 'A\u00fan no tienes conductores guardados. A\u00f1\u00e1delos despu\u00e9s de tus viajes';

  let savedIds = new Set();

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function renderStars(rating, count) {
    if (rating == null) return 'Sin calificaciones';
    const full = Math.round(Number(rating));
    return `${'\u2605'.repeat(full)}${'\u2606'.repeat(5 - full)} ${Number(rating).toFixed(1)} (${count})`;
  }

  function paintButton(button, saved) {
    if (!button) return;
    button.textContent = saved ? '\u2605 Favorito' : '\u2606 Guardar en Favoritos';
    button.dataset.saved = saved ? 'true' : 'false';
  }

  async function loadIds() {
    try {
      const res = await fetch('/favorite-drivers');
      if (!res.ok) return savedIds;
      const data = await res.json();
      savedIds = new Set((data.drivers || []).map((driver) => String(driver.driverId)));
    } catch (error) {
      console.warn('[FavoriteDrivers] No se pudo cargar la lista:', error);
    }
    return savedIds;
  }

  function isSaved(driverId) {
    return savedIds.has(String(driverId));
  }

  async function remove(driverId) {
    const res = await fetch(`/favorite-drivers/${encodeURIComponent(driverId)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || 'No se pudo eliminar el conductor.');
      return false;
    }

    savedIds.delete(String(driverId));
    return true;
  }

  // US29 - Escenarios 01 y 04: guardar o, si ya esta guardado, confirmar su eliminacion
  async function toggle(driverId, button) {
    if (!driverId) return;

    if (isSaved(driverId)) {
      if (!confirm('Este conductor ya est\u00e1 en tus favoritos. \u00bfDeseas eliminarlo de la lista?')) return;
      if (await remove(driverId)) paintButton(button, false);
      return;
    }

    try {
      const res = await fetch('/favorite-drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || 'No se pudo guardar el conductor.');
        return;
      }

      savedIds.add(String(driverId));
      paintButton(button, true);
      alert('Conductor guardado con \u00e9xito');
    } catch (error) {
      console.error('[FavoriteDrivers] Error al guardar:', error);
      alert('Error de conexi\u00f3n al guardar el conductor.');
    }
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="driver-form-card" style="width: 100%; max-width: 520px; margin: auto; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="driver-form-card__header" style="justify-content: space-between; align-items: center;">
          <span>Conductores Frecuentes</span>
          <button type="button" data-action="close" style="background: transparent; border: none; color: white; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div class="driver-form-body" style="overflow-y: auto;">
          <div id="favorite-drivers-list" style="font-family: 'DM Sans', sans-serif;"></div>
        </div>
      </div>`;

    modal.addEventListener('click', async (event) => {
      const target = event.target;
      if (target === modal || target?.dataset?.action === 'close') close();
      if (target?.dataset?.action === 'retry') refresh();

      // US29 - Escenario 02: eliminar y actualizar la vista de inmediato
      if (target?.dataset?.action === 'remove') {
        target.disabled = true;
        if (await remove(target.dataset.driverId)) refresh();
        else target.disabled = false;
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function setList(html) {
    const list = document.getElementById('favorite-drivers-list');
    if (list) list.innerHTML = html;
  }

  function renderMessage(text, withRetry = false) {
    setList(`
      <div style="text-align: center; padding: var(--space-md) 0; opacity: 0.8;">
        <p>${escapeText(text)}</p>
        ${withRetry ? '<button type="button" class="btn btn--ghost btn--sm" data-action="retry">Reintentar</button>' : ''}
      </div>`);
  }

  // US29 - Escenario 05: nombre, estrellas y vehiculo del conductor
  function renderDrivers(drivers) {
    setList(drivers.map((driver) => `
      <div style="border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; padding: var(--space-sm); margin-bottom: var(--space-xs); display: flex; justify-content: space-between; align-items: center; gap: var(--space-xs);">
        <div>
          <strong>${escapeText(driver.name)}</strong>
          <p style="margin: 2px 0; color: #f59e0b;">${escapeText(renderStars(driver.rating, driver.ratingCount))}</p>
          <p style="margin: 2px 0; opacity: 0.8;">&#128663; ${escapeText(driver.vehicle || 'Veh\u00edculo no registrado')}</p>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" data-action="remove" data-driver-id="${escapeText(driver.driverId)}">Eliminar</button>
      </div>`).join(''));
  }

  async function refresh() {
    renderMessage('Cargando tus conductores...');

    try {
      const res = await fetch('/favorite-drivers');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        renderMessage(data.error || 'No se pudo cargar tu lista de conductores.', true);
        return;
      }

      const drivers = Array.isArray(data.drivers) ? data.drivers : [];
      savedIds = new Set(drivers.map((driver) => String(driver.driverId)));

      // US29 - Escenario 03: lista vacia
      if (drivers.length === 0) {
        renderMessage(EMPTY_TEXT);
        return;
      }

      renderDrivers(drivers);
    } catch (error) {
      console.error('[FavoriteDrivers] Error al cargar la lista:', error);
      renderMessage('Error de conexi\u00f3n al cargar tus conductores.', true);
    }
  }

  function open() {
    ensureModal().style.display = 'flex';
    refresh();
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.style.display = 'none';
  }

  return { open, close, refresh, toggle, isSaved, loadIds, paintButton };
})();

window.FavoriteDrivers = FavoriteDrivers;
