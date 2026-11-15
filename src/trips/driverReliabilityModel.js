// trips/driverReliabilityModel.js
// US34 - Escenario 04: historial de fiabilidad del conductor (data/driverStrikes.json).
//
// Cuando un conductor cancela una ruta con pasajeros confirmados a menos de
// 15 minutos de la salida, se registra un "strike" negativo. Este historial es
// interno (oculto): no se expone en ningún endpoint público.

const { v4: uuidv4 } = require('uuid');
const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('driverStrikes.json');

// Minutos antes de la salida a partir de los cuales una cancelación se considera tardía
const LATE_CANCELLATION_MINUTES = 15;

function addStrike({ driverId, routeId, affectedPassengers, minutesBeforeDeparture, reason }) {
  const strikes = store.read();

  const strike = {
    id: uuidv4(),
    driverId: String(driverId),
    routeId: String(routeId),
    type: 'cancelacion_tardia',
    affectedPassengers,
    minutesBeforeDeparture,
    reason: reason || null,
    createdAt: new Date().toISOString(),
  };

  strikes.push(strike);

  if (!store.write(strikes)) {
    console.error('[DriverReliability] No se pudo registrar el strike.');
    return null;
  }

  return strike;
}

function getStrikesByDriver(driverId) {
  return store.read().filter(s => s.driverId === String(driverId));
}

module.exports = {
  LATE_CANCELLATION_MINUTES,
  addStrike,
  getStrikesByDriver,
};
