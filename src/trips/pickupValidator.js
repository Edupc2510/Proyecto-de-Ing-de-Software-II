// src/trips/pickupValidator.js
// Validacion del punto de recojo elegido por el pasajero (US21).

const { isValidCoords, isPointNearRoute, DEFAULT_MAX_DISTANCE_M } = require('../shared/geoUtils');

const MAX_ADDRESS_LENGTH = 200;

/**
 * Valida el punto de recojo recibido en la reserva.
 * @param {object} pickupInput - { address, coords: [lat, lng] }
 * @param {object} route - ruta con originCoords y destCoords
 * @returns {{ valid: boolean, status?: number, error?: string, pickupPoint?: object }}
 */
function validatePickupPoint(pickupInput, route) {
  if (!pickupInput || typeof pickupInput !== 'object') {
    return { valid: false, status: 400, error: 'Debes seleccionar un punto de recojo en el mapa.' };
  }

  if (!isValidCoords(pickupInput.coords)) {
    return { valid: false, status: 400, error: 'Las coordenadas del punto de recojo no son v\u00e1lidas.' };
  }

  const address = String(pickupInput.address || '').trim().slice(0, MAX_ADDRESS_LENGTH);
  const coords = [Number(pickupInput.coords[0]), Number(pickupInput.coords[1])];

  // US21 - Escenario 02: el punto debe estar dentro de la ruta del viaje
  if (!isPointNearRoute(coords, route?.originCoords, route?.destCoords)) {
    const km = (DEFAULT_MAX_DISTANCE_M / 1000).toFixed(1);
    return {
      valid: false,
      status: 422,
      error: `El punto de recojo est\u00e1 fuera de la ruta del viaje. Elige un punto a menos de ${km} km del trayecto.`,
    };
  }

  return {
    valid: true,
    pickupPoint: {
      address: address || 'Punto seleccionado en el mapa',
      coords,
    },
  };
}

module.exports = { validatePickupPoint };
