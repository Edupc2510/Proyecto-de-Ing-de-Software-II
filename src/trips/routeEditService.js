// src/trips/routeEditService.js
// US33 - Reglas para editar una ruta ya publicada por el conductor.

const { getBookingsByRoute, BOOKING_STATUS } = require('./bookingModel');
const { isValidCoords } = require('../shared/geoUtils');

const { validateNotes } = require('./tripNotes');

const EDIT_LOCK_MINUTES = 30;
const MAX_SEATS = 4;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const LOCK_MESSAGE =
  'No puedes editar un viaje pr\u00f3ximo a iniciar. Si tienes una emergencia, canc\u00e9lalo';

const FIELD_LABELS = {
  time: 'hora de salida',
  totalSeats: 'capacidad',
  notes: 'detalles de la ruta',
  origin: 'origen',
  dest: 'destino',
};

class RouteEditError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Reservas activas (no canceladas) de una ruta.
 */
function getActiveBookings(routeId) {
  return getBookingsByRoute(routeId).filter(
    (booking) => booking.status !== BOOKING_STATUS.CANCELLED
  );
}

/**
 * Capacidad de la ruta: total, ocupados y libres.
 * Las rutas antiguas no tienen totalSeats: se calcula como libres + ocupados.
 */
function getRouteCapacity(route) {
  const occupied = getActiveBookings(route.id).length;
  const free = Math.max(0, Number(route.seats) || 0);
  const total = Number.isInteger(route.totalSeats) ? route.totalSeats : free + occupied;

  return { total, occupied, free };
}

/**
 * US33 - Escenario 02: no se edita si faltan menos de 30 minutos para salir.
 */
function isEditLocked(route, now = Date.now()) {
  const departure = Number(route.expiresAtTimestamp);
  if (!Number.isFinite(departure)) return true;
  return departure - now < EDIT_LOCK_MINUTES * 60 * 1000;
}

function assertCanEdit(route, userId, now = Date.now()) {
  if (!route) throw new RouteEditError('La ruta ya no existe.', 404);

  if (!route.driverId || String(route.driverId) !== String(userId)) {
    throw new RouteEditError('No tienes permiso para editar esta ruta.', 403);
  }

  if (route.status === 'cancelada' || route.cancelledAt) {
    throw new RouteEditError('No puedes editar una ruta cancelada.', 409);
  }

  if (isEditLocked(route, now)) {
    throw new RouteEditError(LOCK_MESSAGE, 409);
  }
}

function departureTimestampFor(time, now = Date.now()) {
  const [hours, minutes] = time.split(':').map(Number);
  const departure = new Date(now);
  departure.setHours(hours, minutes, 0, 0);
  return departure.getTime();
}

/**
 * Valida los cambios y devuelve la ruta actualizada (sin guardarla).
 * @param {object} params
 * @param {object} params.route - ruta actual
 * @param {string} params.userId - conductor en sesion
 * @param {object} params.changes - { time?, totalSeats?, notes?, origin?, originCoords?, dest?, destCoords? }
 * @returns {{ updatedRoute: object, changedFields: string[], capacity: object }}
 */
function applyRouteEdit({ route, userId, changes = {}, now = Date.now() }) {
  assertCanEdit(route, userId, now);

  const capacity = getRouteCapacity(route);
  const updated = { ...route };
  const changedFields = [];

  // Hora de salida (US33 - Escenario 01)
  if (changes.time !== undefined) {
    const time = String(changes.time).trim();

    if (!TIME_REGEX.test(time)) {
      throw new RouteEditError('La hora debe tener el formato HH:mm.');
    }

    if (time !== route.time) {
      const departure = departureTimestampFor(time, now);

      if (departure <= now) {
        throw new RouteEditError('La nueva hora de salida no puede estar vencida.');
      }

      updated.time = time;
      updated.expiresAtTimestamp = departure;
      changedFields.push('time');
    }
  }

  // Capacidad total (US33 - Escenario 04)
  if (changes.totalSeats !== undefined) {
    const totalSeats = Number(changes.totalSeats);

    if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > MAX_SEATS) {
      throw new RouteEditError(`La capacidad total debe estar entre 1 y ${MAX_SEATS}.`);
    }

    if (totalSeats < capacity.occupied) {
      throw new RouteEditError(
        `No puedes reducir la capacidad por debajo de los ${capacity.occupied} asiento(s) ya reservados.`
      );
    }

    if (totalSeats !== capacity.total) {
      updated.totalSeats = totalSeats;
      updated.initialSeats = totalSeats;
      updated.seats = totalSeats - capacity.occupied;
      changedFields.push('totalSeats');
    }
  }

  // Detalles de la ruta: avenidas, referencias (US33 - Escenario 03)
  if (changes.notes !== undefined) {
    const error = validateNotes(changes.notes);
    if (error) throw new RouteEditError(error);
    const notes = changes.notes.trim();

    if (notes !== String(route.notes || '')) {
      updated.notes = notes;
      updated.detailsUpdatedAt = new Date(now).toISOString();
      changedFields.push('notes');
    }
  }

  // Origen y destino (opcionales, siempre con coordenadas)
  for (const field of ['origin', 'dest']) {
    if (changes[field] === undefined) continue;

    const text = String(changes[field]).trim();
    const coords = changes[`${field}Coords`];

    if (!text) throw new RouteEditError(`El ${FIELD_LABELS[field]} es obligatorio.`);
    if (!isValidCoords(coords)) {
      throw new RouteEditError(`Debes seleccionar el ${FIELD_LABELS[field]} desde las sugerencias de direcci\u00f3n.`);
    }

    if (text !== route[field]) {
      updated[field] = text;
      updated[`${field}Coords`] = [Number(coords[0]), Number(coords[1])];
      changedFields.push(field);
    }
  }

  if (String(updated.origin || '').toLowerCase() === String(updated.dest || '').toLowerCase()) {
    throw new RouteEditError('El origen y el destino no pueden ser iguales.');
  }

  if (changedFields.length === 0) {
    throw new RouteEditError('No hiciste ning\u00fan cambio en la ruta.');
  }

  updated.updatedAt = new Date(now).toISOString();

  return {
    updatedRoute: updated,
    changedFields,
    capacity: getRouteCapacity(updated),
  };
}

module.exports = {
  EDIT_LOCK_MINUTES,
  LOCK_MESSAGE,
  FIELD_LABELS,
  RouteEditError,
  getActiveBookings,
  getRouteCapacity,
  isEditLocked,
  applyRouteEdit,
};
