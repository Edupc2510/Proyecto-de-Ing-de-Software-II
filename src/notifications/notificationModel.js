// notifications/notificationModel.js
// Persistencia de notificaciones internas en data/notifications.json.

const { v4: uuidv4 } = require('uuid');
const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('notifications.json');

const NOTIFICATION_TYPES = {
  ROUTE_MATCH: 'route_match',         // US31: una ruta publicada coincide con tu ruta habitual
  ROUTE_CANCELLED: 'route_cancelled', // US34: el conductor canceló una ruta que reservaste
  ROUTE_UPDATED: 'route_updated',     // US33: el conductor modifico una ruta que reservaste
  NEW_REQUEST: 'new_request',         // US14: un pasajero reservó en tu ruta
};

const PRIORITY = {
  NORMAL: 'normal',
  HIGH: 'alta',
};

// US31 - Escenario 04: coincidencias dentro de esta ventana se agrupan en un solo aviso
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

// Máximo de notificaciones que se conservan por usuario
const MAX_PER_USER = 50;

const getNotifications = () => store.read();

/**
 * Guarda las notificaciones limitando el historial por usuario.
 */
function saveNotifications(items) {
  const sorted = [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const countByUser = {};

  const trimmed = sorted.filter(n => {
    countByUser[n.userId] = (countByUser[n.userId] || 0) + 1;
    return countByUser[n.userId] <= MAX_PER_USER;
  });

  return store.write(trimmed);
}

function buildNotification(item) {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    userId: String(item.userId),
    type: item.type,
    priority: item.priority || PRIORITY.NORMAL,
    title: item.title,
    message: item.message,
    routeId: item.routeId != null ? String(item.routeId) : null,
    routeIds: item.routeId != null ? [String(item.routeId)] : [],
    alertId: item.alertId || null,
    read: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Crea varias notificaciones de una sola vez (una lectura y una escritura del archivo).
 * @returns {Array} Notificaciones creadas
 */
function createNotifications(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const notifications = getNotifications();
  const created = items.map(buildNotification);

  if (!saveNotifications([...created, ...notifications])) {
    console.error('[NotificationModel] No se pudieron guardar las notificaciones.');
    return [];
  }

  return created;
}

function createNotification(item) {
  return createNotifications([item])[0] || null;
}

/**
 * US31 - Registra una coincidencia de ruta para un pasajero.
 * Si ya existe un aviso NO leído de la misma alerta creado hace menos de 5 minutos,
 * se agrupa en ese aviso ("Hay N nuevos viajes disponibles en tu ruta habitual")
 * en lugar de crear uno nuevo.
 *
 * @param {Array<{userId, alertId, routeId, title, message}>} matches
 */
function addRouteMatchNotifications(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const notifications = getNotifications();
  const now = Date.now();
  const touched = [];

  matches.forEach(match => {
    const existing = notifications.find(n =>
      n.type === NOTIFICATION_TYPES.ROUTE_MATCH &&
      n.userId === String(match.userId) &&
      n.alertId === match.alertId &&
      !n.read &&
      now - new Date(n.createdAt).getTime() <= GROUPING_WINDOW_MS
    );

    if (existing) {
      const routeIds = Array.from(new Set([...(existing.routeIds || []), String(match.routeId)]));

      existing.routeIds = routeIds;
      existing.routeId = null; // Aviso agrupado: ya no apunta a un solo viaje
      existing.title = 'Nuevos viajes en tu ruta habitual';
      existing.message = `Hay ${routeIds.length} nuevos viajes disponibles en tu ruta habitual.`;
      existing.updatedAt = new Date(now).toISOString();
      touched.push(existing);
    } else {
      const created = buildNotification({ ...match, type: NOTIFICATION_TYPES.ROUTE_MATCH });
      notifications.unshift(created);
      touched.push(created);
    }
  });

  if (!saveNotifications(notifications)) {
    console.error('[NotificationModel] No se pudieron guardar las coincidencias.');
    return [];
  }

  return touched;
}

function getNotificationsByUser(userId) {
  return getNotifications()
    .filter(n => n.userId === String(userId))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

/**
 * Marca como leída una notificación del usuario.
 * @returns {Object|null} La notificación actualizada o null si no existe / no es suya
 */
function markAsRead(userId, notificationId) {
  const notifications = getNotifications();
  const index = notifications.findIndex(
    n => n.id === String(notificationId) && n.userId === String(userId)
  );

  if (index === -1) return null;

  notifications[index] = { ...notifications[index], read: true };
  saveNotifications(notifications);
  return notifications[index];
}

function markAllAsRead(userId) {
  const notifications = getNotifications();
  let changed = 0;

  notifications.forEach((n, index) => {
    if (n.userId === String(userId) && !n.read) {
      notifications[index] = { ...n, read: true };
      changed++;
    }
  });

  if (changed > 0) saveNotifications(notifications);
  return changed;
}

module.exports = {
  NOTIFICATION_TYPES,
  PRIORITY,
  GROUPING_WINDOW_MS,
  createNotification,
  createNotifications,
  addRouteMatchNotifications,
  getNotificationsByUser,
  markAsRead,
  markAllAsRead,
};
