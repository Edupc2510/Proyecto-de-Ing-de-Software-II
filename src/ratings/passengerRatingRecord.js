// ratings/passengerRatingRecord.js
// US25 - Calificaciones del conductor hacia el pasajero.
//
// Se guardan en data/ratings.json con el MISMO formato genérico que usa la
// US24 (ver ratings/ratingModel.js), para que ambas historias compartan un
// único archivo:
//   { id, routeId, raterId, rateeId, rateeRole, bookingId, score, comment, createdAt }
//   - raterId:   quién califica (aquí, el conductor)
//   - rateeId:   a quién califican (aquí, el pasajero)
//   - rateeRole: 'passenger' (la US24 guarda 'driver'; por eso no se pisan)

const { v4: uuidv4 } = require('uuid');

const ROLE_PASSENGER = 'passenger';
const RATING_MIN = 1;
const RATING_MAX = 5;
const MAX_COMENTARIO = 300;

/** Crea el registro que se guarda en ratings.json a partir de una reserva. */
function crearCalificacion({ booking, driverId, score, comment }) {
  return {
    id: uuidv4(),
    routeId: String(booking.routeId),
    raterId: String(driverId),
    rateeId: String(booking.passengerId),
    rateeRole: ROLE_PASSENGER,
    bookingId: String(booking.id),
    score,
    comment: comment || null,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { ROLE_PASSENGER, RATING_MIN, RATING_MAX, MAX_COMENTARIO, crearCalificacion };
