// public/js/pickupSelector.js
// US21 - Seleccion del punto de recojo en el mapa del modal de reserva.
//
// Uso desde dashboard.js:
//   PickupSelector.attach(mapa)  -> activa la seleccion con clic en el mapa
//   PickupSelector.getSelection() -> { address, coords: [lat, lng] } o null
//   PickupSelector.useMyLocation() -> usa la ubicacion actual del pasajero
//   PickupSelector.reset()        -> limpia la seleccion al cerrar el modal

const PickupSelector = (() => {
  let map = null;
  let marker = null;
  let selection = null;

  const TEXT_EMPTY = 'Toca el mapa para elegir d\u00f3nde te recogen';

  function updateLabel(message) {
    const label = document.getElementById('modal-pickup-text');
    if (!label) return;
    label.textContent = message || (selection ? selection.address : TEXT_EMPTY);
  }

  // Convierte coordenadas en una direccion legible (Nominatim / OpenStreetMap)
  async function reverseGeocode(lat, lng) {
    try {
      const url =
        'https://nominatim.openstreetmap.org/reverse' +
        `?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=es`;

      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;

      const data = await response.json();
      if (!data.display_name) return null;

      // Solo las primeras partes de la direccion (calle, numero, distrito)
      return data.display_name.split(',').slice(0, 3).join(',').trim();
    } catch (error) {
      console.warn('[PickupSelector] No se pudo obtener la direccion:', error);
      return null;
    }
  }

  // US21 - Escenarios 01 y 04: registrar o cambiar el punto seleccionado
  async function setPoint(lat, lng) {
    if (!map) return;

    const coords = [Number(lat), Number(lng)];

    if (marker) {
      marker.setLatLng(coords);
    } else {
      marker = L.marker(coords, { draggable: true })
        .addTo(map)
        .bindPopup('Tu punto de recojo');

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setPoint(pos.lat, pos.lng);
      });
    }

    marker.openPopup();

    selection = { address: 'Punto seleccionado en el mapa', coords };
    updateLabel('Buscando direcci\u00f3n...');

    const address = await reverseGeocode(coords[0], coords[1]);

    // Si el usuario cambio el punto mientras se buscaba, ignoramos la respuesta vieja
    if (!selection || selection.coords !== coords) return;

    if (address) selection.address = address;
    updateLabel();
  }

  function attach(mapInstance) {
    reset();
    map = mapInstance;
    if (!map) return;

    map.on('click', (event) => setPoint(event.latlng.lat, event.latlng.lng));
    updateLabel();
  }

  // US21 - Escenario 05: pedir permiso de ubicacion al navegador
  function useMyLocation() {
    if (!map) return;

    if (!('geolocation' in navigator)) {
      alert('Tu navegador no permite obtener la ubicaci\u00f3n. Selecciona el punto en el mapa.');
      return;
    }

    updateLabel('Obteniendo tu ubicaci\u00f3n...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.setView([latitude, longitude], 16);
        setPoint(latitude, longitude);
      },
      (error) => {
        updateLabel();
        if (error.code === error.PERMISSION_DENIED) {
          alert('La ubicaci\u00f3n est\u00e1 deshabilitada. Activa el permiso de ubicaci\u00f3n en tu navegador o selecciona el punto en el mapa.');
        } else {
          alert('No se pudo obtener tu ubicaci\u00f3n. Selecciona el punto en el mapa.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function getSelection() {
    return selection ? { address: selection.address, coords: [...selection.coords] } : null;
  }

  function reset() {
    if (map) map.off('click');
    map = null;
    marker = null;
    selection = null;
    updateLabel();
  }

  return { attach, setPoint, useMyLocation, getSelection, reset };
})();

window.PickupSelector = PickupSelector;
