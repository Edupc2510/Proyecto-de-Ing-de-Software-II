// reservations/reservationModel.js
// Reglas de dominio de una Reserva (US17) y de la participación del pasajero
// en el viaje (US35). Las reservas se persisten con el modelo de la US14
// (src/trips/bookingModel.js); aquí solo se definen estados y reglas.

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

function horaDeSalida(reserva) {
  const t = reserva?.route?.departureAt ? new Date(reserva.route.departureAt).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

/**
 * Estado "real" de la reserva: una reserva confirmada cuyo viaje ya salió
 * se considera completada (aunque bookings.json todavía diga "confirmada").
 */
function estadoEfectivo(reserva, ahora = Date.now()) {
  const salida = horaDeSalida(reserva);
  if (reserva.status === RESERVATION_STATUS.CONFIRMED && salida !== null && salida <= ahora) {
    return RESERVATION_STATUS.COMPLETED;
  }
  return reserva.status;
}

module.exports = { RESERVATION_STATUS, PARTICIPATION_STATUS, horaDeSalida, estadoEfectivo };
