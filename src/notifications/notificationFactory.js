// notifications/notificationFactory.js
// ─────────────────────────────────────────────────────────────
// PATRÓN FACTORY (creacional)
// ─────────────────────────────────────────────────────────────
// Centraliza la creación del contenido de cada tipo de notificación
// (título, mensaje, prioridad). Quien necesita avisar algo solo pide:
//
//   NotificationFactory.crear(NOTIFICATION_TYPES.ROUTE_CANCELLED, { ... })
//
// y no necesita saber cómo se redacta cada aviso.
//
// - Responsabilidad única (S): los textos de los avisos viven en un solo lugar.
// - Abierto/cerrado (O): un tipo nuevo se agrega como otro "creador" en el
//   mapa, sin modificar a quienes ya usan la fábrica.
//
// La fábrica solo arma el contenido. Guardarlo (id, fecha, leído) le toca a
// notificationModel.js.
// ─────────────────────────────────────────────────────────────

const { NOTIFICATION_TYPES, PRIORITY } = require('./notificationModel');

const shortPlace = (text) => String(text || '').split(',')[0].trim();
const routeLabel = (route) => `${shortPlace(route.origin)} → ${shortPlace(route.dest)}`;

// Un "creador" por tipo de notificación
const creators = {
  // US31: una ruta publicada coincide con la ruta habitual del pasajero
  [NOTIFICATION_TYPES.ROUTE_MATCH]: ({ route, alert }) => ({
    userId: alert.userId,
    type: NOTIFICATION_TYPES.ROUTE_MATCH,
    priority: PRIORITY.NORMAL,
    title: 'Nuevo viaje en tu ruta habitual',
    message: `${routeLabel(route)} a las ${route.time}. ¡Reserva antes de que se llenen los asientos!`,
    routeId: route.id,
    alertId: alert.id,
  }),

  // US14: un pasajero reservó en la ruta del conductor
  [NOTIFICATION_TYPES.NEW_REQUEST]: ({ route, passengerName }) => ({
    userId: route.driverId,
    type: NOTIFICATION_TYPES.NEW_REQUEST,
    priority: PRIORITY.NORMAL,
    title: 'Nueva solicitud de viaje',
    message: `${passengerName || 'Un pasajero'} reservó un asiento en tu ruta ${routeLabel(route)} (${route.time}).`,
    routeId: route.id,
  }),

  // US34: el conductor canceló una ruta que el pasajero había reservado
  [NOTIFICATION_TYPES.ROUTE_CANCELLED]: ({ route, booking, reason }) => ({
    userId: booking.passengerId,
    type: NOTIFICATION_TYPES.ROUTE_CANCELLED,
    priority: PRIORITY.HIGH,
    title: 'Tu viaje fue cancelado',
    message: `El conductor canceló el viaje ${routeLabel(route)} de las ${route.time}.` +
      (reason ? ` Motivo: ${reason}` : '') +
      ' Busca otra ruta disponible.',
    routeId: route.id,
  }),
};

const NotificationFactory = {
  /**
   * Crea el contenido de una notificación del tipo indicado.
   * @param {string} type - Uno de NOTIFICATION_TYPES
   * @param {Object} data - Datos que necesita ese tipo (route, alert, booking, ...)
   * @returns {Object} Notificación lista para guardar con notificationModel
   */
  crear(type, data) {
    const creator = creators[type];
    if (!creator) {
      throw new Error(`[NotificationFactory] Tipo de notificación desconocido: ${type}`);
    }
    return creator(data);
  },
};

module.exports = { NotificationFactory };
