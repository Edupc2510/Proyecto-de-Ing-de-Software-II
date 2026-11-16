// trips/reliabilitySubscriber.js
// Observador (patrón Observer) del historial de fiabilidad del conductor.
// US34 - Escenario 04: si el conductor cancela con pasajeros y faltan menos de
// 15 minutos para la salida, se registra un strike.

const { TRIP_EVENTS } = require('../shared/events/tripEvents');
const { LATE_CANCELLATION_MINUTES, addStrike } = require('./driverReliabilityModel');

/**
 * @param {import('../shared/events/tripEvents').TripEventBus} bus
 */
function registerReliabilityObserver(bus) {
  bus.subscribe(TRIP_EVENTS.ROUTE_CANCELLED, 'fiabilidad', ({ route, driverId, cancelledBookings, reason, cancelledAt }) => {
    const minutesBeforeDeparture = Math.floor((Number(route.expiresAtTimestamp) - cancelledAt) / 60000);
    const isLateCancellation =
      cancelledBookings.length > 0 &&
      minutesBeforeDeparture < LATE_CANCELLATION_MINUTES;

    if (!isLateCancellation) return;

    addStrike({
      driverId,
      routeId: route.id,
      affectedPassengers: cancelledBookings.length,
      minutesBeforeDeparture,
      reason,
    });
  });
}

module.exports = { registerReliabilityObserver };
