// notifications/routeMatchingService.js
// US31 - Lógica de coincidencia entre rutas publicadas y alertas de pasajeros.

const { getAlerts } = require('./routeAlertModel');
const { addRouteMatchNotifications } = require('./notificationModel');

// Distancia máxima (km) entre origen/destino de la alerta y de la ruta para considerarla coincidente
const MATCH_RADIUS_KM = 2;

/**
 * Distancia en km entre dos coordenadas [lat, lng] usando la fórmula de Haversine.
 */
function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

/**
 * Indica si la hora de la ruta cae dentro del rango de la alerta.
 * Si la alerta no tiene rango horario, cualquier hora coincide.
 */
function isTimeInRange(routeTime, timeFrom, timeTo) {
  if (!timeFrom || !timeTo) return true;

  const t = toMinutes(routeTime);
  const from = toMinutes(timeFrom);
  const to = toMinutes(timeTo);

  // Rango normal (07:00 - 09:00) o rango que cruza medianoche (22:00 - 01:00)
  return from <= to ? t >= from && t <= to : t >= from || t <= to;
}

const hasValidCoords = (coords) =>
  Array.isArray(coords) &&
  coords.length === 2 &&
  Number.isFinite(Number(coords[0])) &&
  Number.isFinite(Number(coords[1]));

/**
 * Determina si una ruta coincide con una alerta.
 */
function routeMatchesAlert(route, alert) {
  if (!route || !alert) return false;

  // Escenario 05: el pasajero desmarcó "Recibir alertas"
  if (alert.active === false) return false;

  // El conductor no debe recibir alertas por su propia ruta
  if (route.driverId && String(route.driverId) === String(alert.userId)) return false;

  if (!hasValidCoords(route.originCoords) || !hasValidCoords(route.destCoords)) return false;
  if (!hasValidCoords(alert.originCoords) || !hasValidCoords(alert.destCoords)) return false;

  const originDistance = distanceKm(route.originCoords.map(Number), alert.originCoords.map(Number));
  const destDistance = distanceKm(route.destCoords.map(Number), alert.destCoords.map(Number));

  return (
    originDistance <= MATCH_RADIUS_KM &&
    destDistance <= MATCH_RADIUS_KM &&
    isTimeInRange(route.time, alert.timeFrom, alert.timeTo)
  );
}

// El texto del aviso lo arma la fábrica de notificaciones (patrón Factory)
const { NotificationFactory } = require('./notificationFactory');
const { NOTIFICATION_TYPES } = require('./notificationModel');

function buildMatchNotification(route, alert) {
  return NotificationFactory.crear(NOTIFICATION_TYPES.ROUTE_MATCH, { route, alert });
}

/**
 * Se ejecuta cuando un conductor publica una ruta: notifica a todos los
 * pasajeros cuyas alertas coinciden con ella.
 * @returns {number} Cantidad de pasajeros notificados
 */
function notifyMatchingAlertsForRoute(route) {
  try {
    const alerts = getAlerts();

    // Un pasajero con varias alertas coincidentes recibe una sola notificación por ruta
    const notifiedUsers = new Set();
    const toCreate = [];

    alerts.forEach(alert => {
      if (notifiedUsers.has(alert.userId)) return;
      if (routeMatchesAlert(route, alert)) {
        notifiedUsers.add(alert.userId);
        toCreate.push(buildMatchNotification(route, alert));
      }
    });

    addRouteMatchNotifications(toCreate);
    return toCreate.length;
  } catch (error) {
    // Un fallo en las notificaciones no debe impedir publicar la ruta
    console.error('[RouteMatching] Error notificando coincidencias:', error);
    return 0;
  }
}

/**
 * Se ejecuta cuando un pasajero crea una alerta: revisa las rutas ya publicadas
 * y le notifica las que coinciden.
 * @returns {Array} Rutas coincidentes
 */
function notifyExistingRoutesForAlert(alert, activeRoutes) {
  try {
    const matches = (activeRoutes || []).filter(route => routeMatchesAlert(route, alert));
    addRouteMatchNotifications(matches.map(route => buildMatchNotification(route, alert)));
    return matches;
  } catch (error) {
    console.error('[RouteMatching] Error revisando rutas existentes:', error);
    return [];
  }
}

module.exports = {
  MATCH_RADIUS_KM,
  distanceKm,
  isTimeInRange,
  routeMatchesAlert,
  notifyMatchingAlertsForRoute,
  notifyExistingRoutesForAlert,
};
