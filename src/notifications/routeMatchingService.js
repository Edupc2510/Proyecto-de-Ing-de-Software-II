// notifications/routeMatchingService.js
// US31 - Lógica de coincidencia entre rutas publicadas y alertas de pasajeros.

const { getAlerts } = require('./routeAlertModel');
const { addRouteMatchNotifications } = require('./notificationModel');
const { AccountFacade } = require('../account/accountFacade');

// US32: si el usuario apagó las alertas de nuevos viajes, no se le notifica
const cuentas = AccountFacade.crearPorDefecto();
const puedeNotificar = (userId) => cuentas.puedeNotificar(userId, 'coincidenciaRuta');

// Patrón Strategy: cada regla de coincidencia es un criterio (ver matchCriteria.js)
const {
  MATCH_RADIUS_KM,
  distanceKm,
  isTimeInRange,
  CriterioPreferenciaCuenta,
  crearCriteriosBase,
} = require('./matchCriteria');

// Criterios puros de la US31 (sin leer datos): los usan las pruebas y routeMatchesAlert
const CRITERIOS_BASE = crearCriteriosBase();
// Criterios que usa la app al notificar: los de la US31 + la preferencia de cuenta de la US32
const CRITERIOS_NOTIFICACION = [...CRITERIOS_BASE, new CriterioPreferenciaCuenta(puedeNotificar)];

/**
 * Determina si una ruta coincide con una alerta: deben cumplirse todos los criterios.
 * @param {Object} route
 * @param {Object} alert
 * @param {Array<{cumple: Function}>} [criterios] - estrategias a aplicar
 */
function routeMatchesAlert(route, alert, criterios = CRITERIOS_BASE) {
  if (!route || !alert) return false;
  return criterios.every(criterio => criterio.cumple(route, alert));
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
      if (routeMatchesAlert(route, alert, CRITERIOS_NOTIFICACION)) {
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
    const matches = (activeRoutes || []).filter(route => routeMatchesAlert(route, alert, CRITERIOS_NOTIFICACION));
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
