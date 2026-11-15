// ratings/ratingModel.js
// US24 - Persistencia de calificaciones a conductores en data/ratings.json.

const { v4: uuidv4 } = require('uuid');
const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('ratings.json');

const getRatings = () => store.read();

function findRatingByBooking(bookingId) {
  return getRatings().find(r => r.bookingId === String(bookingId)) || null;
}

function createRating({ booking, score, comment }) {
  const ratings = getRatings();

  const rating = {
    id: uuidv4(),
    bookingId: String(booking.id),
    routeId: String(booking.routeId),
    driverId: String(booking.driverId),
    passengerId: String(booking.passengerId),
    score,
    comment: comment || '',
    createdAt: new Date().toISOString(),
  };

  ratings.push(rating);

  if (!store.write(ratings)) {
    throw new Error('No se pudo guardar la calificación.');
  }

  return rating;
}

/**
 * Promedio de calificaciones de un conductor.
 * @returns {{ average: number|null, count: number }}
 */
function getDriverRatingSummary(driverId) {
  const driverRatings = getRatings().filter(r => r.driverId === String(driverId));

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
  getRatings,
  findRatingByBooking,
  createRating,
  getDriverRatingSummary,
};
