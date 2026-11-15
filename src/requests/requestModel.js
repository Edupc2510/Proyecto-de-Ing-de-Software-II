// requests/requestModel.js
// Modelo de dominio de una Solicitud de viaje (US15).
//
// Una solicitud nace cuando un pasajero pide unirse a la ruta de un conductor.
// Guarda una "foto" de la ruta y del conductor para que el pasajero pueda
// seguir viendo el estado aunque la ruta original se elimine al vencer.

const { v4: uuidv4 } = require('uuid');

const REQUEST_STATUS = Object.freeze({
  PENDING: 'pendiente',
  ACCEPTED: 'aceptada',
  REJECTED: 'rechazada',
  CANCELLED: 'cancelada',
  EXPIRED: 'expirada',
});

/**
 * Construye una nueva solicitud con su historial inicial.
 */
function crearSolicitud({ passengerId, routeId, driverId, driver, route, seatsRequested = 1, message = '', demo = false }) {
  const ahora = new Date().toISOString();
  return {
    id: uuidv4(),
    passengerId: String(passengerId),
    routeId: routeId != null ? String(routeId) : null,
    driverId: driverId != null ? String(driverId) : null,
    driver: {
      name: driver?.name || 'Conductor MoveShare',
      phone: driver?.phone || null,
      email: driver?.email || null,
    },
    route: {
      origin: route?.origin || '',
      dest: route?.dest || '',
      time: route?.time || '',
      departureAt: route?.departureAt || null,
    },
    seatsRequested: Number(seatsRequested) || 1,
    message: String(message || ''),
    status: REQUEST_STATUS.PENDING,
    responseNote: null,
    history: [{ status: REQUEST_STATUS.PENDING, at: ahora, note: 'Solicitud enviada al conductor.' }],
    createdAt: ahora,
    updatedAt: ahora,
    demo: Boolean(demo),
  };
}

/**
 * Devuelve los cambios necesarios para pasar una solicitud a un nuevo estado,
 * agregando la transición al historial.
 */
function transicion(solicitud, nuevoEstado, nota) {
  return {
    status: nuevoEstado,
    history: [...(solicitud.history || []), { status: nuevoEstado, at: new Date().toISOString(), note: nota || null }],
  };
}

module.exports = { REQUEST_STATUS, crearSolicitud, transicion };
