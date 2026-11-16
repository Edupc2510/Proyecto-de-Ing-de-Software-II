// public/js/tripSort.js
// Selector "Ordenar por" de la lista de viajes del pasajero (US27 y US28).
//
//  - Las opciones llegan del servidor (GET /trip-catalog -> ordenes), así que
//    un criterio nuevo en el backend aparece aquí sin tocar este archivo.
//  - US27 esc.05: el criterio elegido se guarda en sessionStorage; al volver de
//    ver un viaje o de otra pantalla la lista conserva el orden.
//  - US28 esc.04: refresco automático cada 5 s para que el contador de asientos
//    baje cuando otro pasajero reserva, sin recargar la página.
var TripSortControl = (function () {
  var STORAGE_KEY = 'moveshare.tripSort';
  var REFRESH_MS = 5000;
  var timer = null;

  function leer() {
    try { return sessionStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
  }

  function guardar(clave) {
    try { sessionStorage.setItem(STORAGE_KEY, clave); } catch (e) { /* ignorar */ }
  }

  /** URL del catálogo con el criterio guardado (o el del servidor por defecto). */
  function catalogUrl() {
    var orden = leer();
    return orden ? '/trip-catalog?orden=' + encodeURIComponent(orden) : '/trip-catalog';
  }

  /** Dibuja (una sola vez) el selector y marca la opción activa. */
  function render(ordenes, activa) {
    var barra = document.getElementById('trip-sort-bar');
    if (!barra || !Array.isArray(ordenes)) return;

    var select = document.getElementById('trip-sort-select');
    if (!select) {
      barra.innerHTML =
        '<label class="trip-sort-bar__label" for="trip-sort-select">Ordenar por:</label>' +
        '<select id="trip-sort-select" class="trip-sort-bar__select"></select>';
      select = document.getElementById('trip-sort-select');
      select.addEventListener('change', function () {
        guardar(select.value);
        if (typeof loadPassengerRoutes === 'function') loadPassengerRoutes();
      });
    }

    var opciones = ordenes.map(function (o) {
      return '<option value="' + o.clave + '">' + o.etiqueta + '</option>';
    }).join('');
    if (select.dataset.opciones !== opciones) {
      select.innerHTML = opciones;
      select.dataset.opciones = opciones;
    }
    select.value = activa;
  }

  function startAutoRefresh(refrescar) {
    stopAutoRefresh();
    timer = setInterval(function () {
      if (!document.hidden) refrescar();
    }, REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  return { catalogUrl: catalogUrl, render: render, startAutoRefresh: startAutoRefresh, stopAutoRefresh: stopAutoRefresh };
})();
