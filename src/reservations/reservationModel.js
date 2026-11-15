// reservations/reservationModel.js
// Modelo de dominio de una Reserva (US17) y de la participación del
// pasajero en el viaje (US35).

const { v4: uuidv4 } = require('uuid');

const RESERVATION_STATUS = Object.freeze({
  CONFIRMED: 'confirmada',
  COMPLETED: 'completada',
  CANCELLED: 'cancelada',
});

const PARTICIPATION_STATUS = Object.freeze({
  PENDING: 'pendiente',
  CONFIRMED: 'confirmada',
  DECLINED: 'declinada',
});

function crearReserva({ passengerId, requestId = null, routeId, driverId, driver, route, seats = 1, price = null, demo = false }) {
  const ahora = new Date().toISOString();
  return {
    id: uuidv4(),
    passengerId: String(passengerId),
    requestId,
    routeId: routeId != null ? String(routeId) : null,
    driverId: driverId != null ? String(driverId) : null,
    driver: {
      name: driver?.name || 'Conductor MoveShare',
      phone: driver?.phone || null,
      email: driver?.email || null,
      vehicle: driver?.vehicle || null,
    },
    route: {
      origin: route?.origin || '',
      dest: route?.dest || '',
      time: route?.time || '',
      departureAt: route?.departureAt || null,
    },
    seats: Number(seats) || 1,
    price,
    status: RESERVATION_STATUS.CONFIRMED,
    participation: { status: PARTICIPATION_STATUS.PENDING, updatedAt: ahora, note: null },
    createdAt: ahora,
    updatedAt: ahora,
    demo: Boolean(demo),
  };
}

function horaDeSalida(reserva) {
  const t = reserva?.route?.departureAt ? new Date(reserva.route.departureAt).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

/**
 * Estado "real" de la reserva: una reserva confirmada cuyo viaje ya salió
 * se considera completada (aunque el JSON todavía diga "confirmada").
 */
function estadoEfectivo(reserva, ahora = Date.now()) {
  const salida = horaDeSalida(reserva);
  if (reserva.status === RESERVATION_STATUS.CONFIRMED && salida !== null && salida <= ahora) {
    return RESERVATION_STATUS.COMPLETED;
  }
  return reserva.status;
}

module.exports = { RESERVATION_STATUS, PARTICIPATION_STATUS, crearReserva, horaDeSalida, estadoEfectivo };
