// notifications/notificationController.js
// Endpoints de notificaciones internas y de alertas de ruta habitual (US31).

const {
  getNotificationsByUser,
  markAsRead,
  markAllAsRead,
} = require('./notificationModel');

const {
  MAX_ALERTS_PER_USER,
  getAlertsByUser,
  createAlert,
  setAlertActive,
  deleteAlert,
} = require('./routeAlertModel');

const { notifyExistingRoutesForAlert } = require('./routeMatchingService');
const { getRoutes, isRouteActive } = require('../trips/routeModel');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getUserId = (req) => req.session?.userId || null;

function parseCoords(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;

  const lat = Number(value[0]);
  const lng = Number(value[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return [lat, lng];
}

// ─────────────────────────────────────────────────────────────
// NOTIFICACIONES
// ─────────────────────────────────────────────────────────────

/**
 * GET /notifications
 * Lista las notificaciones del usuario y la cantidad sin leer.
 */
function listNotifications(req, res) {
  try {
    const notifications = getNotificationsByUser(getUserId(req));
    const unreadCount = notifications.filter(n => !n.read).length;

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error en listNotifications:', error);
    return res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' });
  }
}

/**
 * PATCH /notifications/:id/read
 */
function readNotification(req, res) {
  try {
    const updated = markAsRead(getUserId(req), req.params.id);

    if (!updated) {
      return res.status(404).json({ error: 'La notificación no existe.' });
    }

    return res.status(200).json({ notification: updated });
  } catch (error) {
    console.error('Error en readNotification:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la notificación.' });
  }
}

/**
 * PATCH /notifications/read-all
 */
function readAllNotifications(req, res) {
  try {
    const updated = markAllAsRead(getUserId(req));
    return res.status(200).json({ updated });
  } catch (error) {
    console.error('Error en readAllNotifications:', error);
    return res.status(500).json({ error: 'No se pudieron actualizar las notificaciones.' });
  }
}

// ─────────────────────────────────────────────────────────────
// ALERTAS DE RUTA HABITUAL (US31)
// ─────────────────────────────────────────────────────────────

/**
 * GET /notifications/alerts
 */
function listAlerts(req, res) {
  try {
    return res.status(200).json(getAlertsByUser(getUserId(req)));
  } catch (error) {
    console.error('Error en listAlerts:', error);
    return res.status(500).json({ error: 'No se pudieron cargar tus rutas habituales.' });
  }
}

/**
 * POST /notifications/alerts
 * Body: { origin, originCoords, dest, destCoords, timeFrom?, timeTo? }
 */
function addAlert(req, res) {
  try {
    const userId = getUserId(req);
    const body = req.body || {};

    const origin = String(body.origin || '').trim();
    const dest = String(body.dest || '').trim();
    const timeFrom = String(body.timeFrom || '').trim();
    const timeTo = String(body.timeTo || '').trim();
    const originCoords = parseCoords(body.originCoords);
    const destCoords = parseCoords(body.destCoords);

    if (!origin || !originCoords) {
      return res.status(400).json({ error: 'Selecciona el origen desde las sugerencias de dirección.' });
    }

    if (!dest || !destCoords) {
      return res.status(400).json({ error: 'Selecciona el destino desde las sugerencias de dirección.' });
    }

    if (origin.toLowerCase() === dest.toLowerCase()) {
      return res.status(400).json({ error: 'El origen y el destino no pueden ser iguales.' });
    }

    // El rango horario es opcional, pero si se indica deben venir ambas horas
    if ((timeFrom && !timeTo) || (!timeFrom && timeTo)) {
      return res.status(400).json({ error: 'Indica la hora de inicio y fin del rango, o deja ambas vacías.' });
    }

    if (timeFrom && (!TIME_REGEX.test(timeFrom) || !TIME_REGEX.test(timeTo))) {
      return res.status(400).json({ error: 'Las horas deben tener el formato HH:mm.' });
    }

    if (timeFrom && timeFrom === timeTo) {
      return res.status(400).json({ error: 'La hora de inicio y fin del rango no pueden ser iguales.' });
    }

    if (getAlertsByUser(userId).length >= MAX_ALERTS_PER_USER) {
      return res.status(409).json({
        error: `Solo puedes tener hasta ${MAX_ALERTS_PER_USER} rutas habituales. Elimina una para agregar otra.`,
      });
    }

    const alert = createAlert({
      userId,
      origin,
      originCoords,
      dest,
      destCoords,
      timeFrom: timeFrom || null,
      timeTo: timeTo || null,
    });

    // Revisar si ya existen rutas publicadas que coinciden
    const activeRoutes = getRoutes().filter(route => isRouteActive(route));
    const matches = notifyExistingRoutesForAlert(alert, activeRoutes);

    return res.status(201).json({
      message: matches.length > 0
        ? `Ruta habitual guardada. Encontramos ${matches.length} viaje(s) que ya coinciden.`
        : 'Ruta habitual guardada. Te avisaremos cuando un conductor publique un viaje que coincida.',
      alert,
      matchesFound: matches.length,
    });
  } catch (error) {
    console.error('Error en addAlert:', error);
    return res.status(500).json({ error: 'No se pudo guardar tu ruta habitual.' });
  }
}

/**
 * PATCH /notifications/alerts/:id
 * Body: { active: boolean }  →  opción "Recibir alertas"
 */
function toggleAlert(req, res) {
  try {
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ error: 'El campo "active" debe ser verdadero o falso.' });
    }

    const updated = setAlertActive(getUserId(req), req.params.id, req.body.active);

    if (!updated) {
      return res.status(404).json({ error: 'La ruta habitual no existe.' });
    }

    return res.status(200).json({
      message: updated.active
        ? 'Volverás a recibir alertas para esta ruta.'
        : 'Alertas suspendidas para esta ruta.',
      alert: updated,
    });
  } catch (error) {
    console.error('Error en toggleAlert:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la ruta habitual.' });
  }
}

/**
 * DELETE /notifications/alerts/:id
 */
function removeAlert(req, res) {
  try {
    const deleted = deleteAlert(getUserId(req), req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'La ruta habitual no existe.' });
    }

    return res.status(200).json({ message: 'Ruta habitual eliminada.' });
  } catch (error) {
    console.error('Error en removeAlert:', error);
    return res.status(500).json({ error: 'No se pudo eliminar la ruta habitual.' });
  }
}

module.exports = {
  listNotifications,
  readNotification,
  readAllNotifications,
  listAlerts,
  addAlert,
  toggleAlert,
  removeAlert,
};
