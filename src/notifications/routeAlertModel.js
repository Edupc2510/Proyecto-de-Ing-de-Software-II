// notifications/routeAlertModel.js
// Persistencia de alertas de ruta (US31) en data/routeAlerts.json.
//
// Una alerta representa la "ruta habitual" de un pasajero
// (origen, destino y opcionalmente un rango horario). Cuando un conductor
// publica una ruta que coincide, se le notifica al pasajero.
// El campo "active" corresponde a la opción "Recibir alertas" (Escenario 05).

const { v4: uuidv4 } = require('uuid');
const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('routeAlerts.json');

// Máximo de alertas activas por pasajero
const MAX_ALERTS_PER_USER = 5;

const getAlerts = () => store.read();
const saveAlerts = (alerts) => store.write(alerts);

function getAlertsByUser(userId) {
  return getAlerts()
    .filter(a => a.userId === String(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createAlert(data) {
  const alerts = getAlerts();

  const alert = {
    id: uuidv4(),
    userId: String(data.userId),
    origin: data.origin,
    originCoords: data.originCoords,
    dest: data.dest,
    destCoords: data.destCoords,
    timeFrom: data.timeFrom || null,
    timeTo: data.timeTo || null,
    active: true,
    createdAt: new Date().toISOString(),
  };

  alerts.push(alert);

  if (!saveAlerts(alerts)) {
    throw new Error('No se pudo guardar la alerta.');
  }

  return alert;
}

/**
 * Activa o desactiva la recepción de alertas de una ruta habitual.
 * @returns {Object|null} La alerta actualizada o null si no existe / no es suya
 */
function setAlertActive(userId, alertId, active) {
  const alerts = getAlerts();
  const index = alerts.findIndex(a => a.id === String(alertId) && a.userId === String(userId));

  if (index === -1) return null;

  alerts[index] = { ...alerts[index], active: Boolean(active) };

  if (!saveAlerts(alerts)) {
    throw new Error('No se pudo actualizar la alerta.');
  }

  return alerts[index];
}

/**
 * Elimina una alerta solo si pertenece al usuario.
 * @returns {boolean} true si se eliminó
 */
function deleteAlert(userId, alertId) {
  const alerts = getAlerts();
  const index = alerts.findIndex(a => a.id === String(alertId) && a.userId === String(userId));

  if (index === -1) return false;

  alerts.splice(index, 1);
  return saveAlerts(alerts);
}

module.exports = {
  MAX_ALERTS_PER_USER,
  getAlerts,
  getAlertsByUser,
  createAlert,
  setAlertActive,
  deleteAlert,
};
