// ratings/ratingModel.js
// US24 - Calificaciones del pasajero hacia el conductor.
//
// Se guardan en data/ratings.json con el MISMO formato genérico que usa la
// US25 (calificación del conductor hacia el pasajero), para que ambas
// historias compartan un único archivo de calificaciones:
//   { id, routeId, raterId, rateeId, rateeRole, score, comment, createdAt }
//   - raterId:   quién califica (aquí, el pasajero)
//   - rateeId:   a quién califican (aquí, el conductor)
//   - rateeRole: 'driver' | 'passenger' → rol de quien recibe la nota
// Además se guarda bookingId para saber de qué reserva sale la calificación.

const { v4: uuidv4 } = require('uuid');
const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('ratings.json');

const ROLE_DRIVER = 'driver';

const getRatings = () => store.read();

/**
 * Calificaciones que recibió un conductor (solo las de rol "driver").
 */
const getDriverRatings = (driverId) =>
  getRatings().filter(r => r.rateeRole === ROLE_DRIVER && r.rateeId === String(driverId));

/**
 * Calificación que el pasajero ya le dio al conductor por un viaje, o null.
 * Se busca por la combinación viaje + quién califica + a quién (igual que en US25).
 */
function findDriverRating({ routeId, passengerId, driverId }) {
  return getRatings().find(r =>
    r.rateeRole === ROLE_DRIVER &&
    r.routeId === String(routeId) &&
    r.raterId === String(passengerId) &&
    r.rateeId === String(driverId)
  ) || null;
}

function createDriverRating({ booking, score, comment }) {
  const ratings = getRatings();

  const rating = {
    id: uuidv4(),
    routeId: String(booking.routeId),
    raterId: String(booking.passengerId),
    rateeId: String(booking.driverId),
    rateeRole: ROLE_DRIVER,
    bookingId: String(booking.id),
    score,
    comment: comment || null,
    createdAt: new Date().toISOString(),
  };

  ratings.push(rating);

  if (!store.write(ratings)) {
    throw new Error('No se pudo guardar la calificación.');
  }

  return rating;
}

/**
 * Reputación del conductor: promedio y cantidad de calificaciones recibidas.
 * @returns {{ average: number|null, count: number }}
 */
function getDriverRatingSummary(driverId) {
  const driverRatings = getDriverRatings(driverId);

  if (driverRatings.length === 0) {
    return { average: null, count: 0 };
  }

  const total = driverRatings.reduce((sum, r) => sum + Number(r.score), 0);

  return {
    average: Math.round((total / driverRatings.length) * 10) / 10,
    count: driverRatings.length,
  };
}

module.exports = {
  ROLE_DRIVER,
  getDriverRatings,
  findDriverRating,
  createDriverRating,
  getDriverRatingSummary,
};
