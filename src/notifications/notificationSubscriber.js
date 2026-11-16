// notifications/notificationSubscriber.js
// Observador (patrón Observer) que convierte los eventos de viaje en
// notificaciones internas. El contenido de cada aviso lo arma
// NotificationFactory (patrón Factory).

const { TRIP_EVENTS } = require('../shared/events/tripEvents');
const { NotificationFactory } = require('./notificationFactory');
const { createNotification, createNotifications, NOTIFICATION_TYPES } = require('./notificationModel');
const { notifyMatchingAlertsForRoute } = require('./routeMatchingService');

/**
 * Suscribe las reacciones de notificaciones al bus de eventos de viaje.
 * @param {import('../shared/events/tripEvents').TripEventBus} bus
 */
function registerNotificationObserver(bus) {
  // US31: nueva ruta → avisar a quienes tienen una ruta habitual que coincide
  bus.subscribe(TRIP_EVENTS.ROUTE_PUBLISHED, 'notificaciones', ({ route }) => {
    notifyMatchingAlertsForRoute(route);
  });

  // US14: nueva reserva → avisar al conductor
  bus.subscribe(TRIP_EVENTS.BOOKING_CREATED, 'notificaciones', ({ route, passengerName }) => {
    if (!route.driverId) return;
    createNotification(NotificationFactory.crear(NOTIFICATION_TYPES.NEW_REQUEST, { route, passengerName }));
  });

  // US34: ruta cancelada → avisar con prioridad alta a cada pasajero liberado
  bus.subscribe(TRIP_EVENTS.ROUTE_CANCELLED, 'notificaciones', ({ route, cancelledBookings, reason }) => {
    createNotifications(cancelledBookings.map(booking =>
      NotificationFactory.crear(NOTIFICATION_TYPES.ROUTE_CANCELLED, { route, booking, reason })
    ));
  });
}

module.exports = { registerNotificationObserver };
