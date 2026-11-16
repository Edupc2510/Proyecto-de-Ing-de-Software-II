// src/trips/tripHistoryService.js
// US23 - Historial de viajes del pasajero, construido a partir de sus reservas.

const { getBookingsByPassenger, BOOKING_STATUS } = require('./bookingModel');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TRIP_STATUS = {
  COMPLETED: 'realizado',
  UPCOMING: 'proximo',
  CANCELLED: 'cancelado',
};

/**
 * Convierte un timestamp en fecha local "AAAA-MM-DD".
 */
function toDateKey(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Valida una fecha del filtro. Acepta vacio (sin filtro) o "AAAA-MM-DD".
 */
function isValidDateFilter(value) {
  if (!value) return true;
  if (!DATE_PATTERN.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

/**
 * Momento del viaje: hora de salida de la ruta o, si no existe, fecha de la reserva.
 */
function getTripTimestamp(booking) {
  const departure = Number(booking?.routeSnapshot?.expiresAtTimestamp);
  if (Number.isFinite(departure) && departure > 0) return departure;

  const created = new Date(booking?.createdAt).getTime();
  return Number.isNaN(created) ? null : created;
}

function getTripStatus(booking, tripTimestamp, now) {
  if (booking.status === BOOKING_STATUS.CANCELLED) return TRIP_STATUS.CANCELLED;
  if (tripTimestamp !== null && tripTimestamp <= now) return TRIP_STATUS.COMPLETED;
  return TRIP_STATUS.UPCOMING;
}

/**
 * Construye el historial de viajes del pasajero.
 * @param {string} passengerId
 * @param {{ from?: string, to?: string }} filters - fechas "AAAA-MM-DD" (opcionales)
 * @param {Array} [bookings] - reservas a usar (por defecto, las del pasajero)
 * @returns {Array} viajes ordenados del mas reciente al mas antiguo
 */
function buildTripHistory(passengerId, filters = {}, bookings = null, now = Date.now()) {
  const source = bookings || getBookingsByPassenger(passengerId);

  const trips = source.map((booking) => {
    const tripTimestamp = getTripTimestamp(booking);

    return {
      bookingId: booking.id,
      routeId: booking.routeId,
      driverId: booking.driverId,
      origin: booking.routeSnapshot?.origin || '',
      dest: booking.routeSnapshot?.dest || '',
      time: booking.routeSnapshot?.time || '',
      date: tripTimestamp !== null ? toDateKey(tripTimestamp) : null,
      tripTimestamp,
      pickupPoint: booking.pickupPoint || null,
      status: getTripStatus(booking, tripTimestamp, now),
      bookedAt: booking.createdAt || null,
    };
  });

  // US23 - Escenario 03: filtro por fecha
  const filtered = trips.filter((trip) => {
    if (filters.from && (!trip.date || trip.date < filters.from)) return false;
    if (filters.to && (!trip.date || trip.date > filters.to)) return false;
    return true;
  });

  return filtered.sort((a, b) => (b.tripTimestamp || 0) - (a.tripTimestamp || 0));
}

module.exports = {
  TRIP_STATUS,
  isValidDateFilter,
  buildTripHistory,
};
