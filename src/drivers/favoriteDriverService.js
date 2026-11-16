// src/drivers/favoriteDriverService.js
// US29 - Reglas de negocio de los conductores frecuentes del pasajero.

const {
  getFavoritesByPassenger,
  isFavorite,
  addFavorite,
  removeFavorite,
} = require('./favoriteDriverModel');
const { getBookingsByPassenger, BOOKING_STATUS } = require('../trips/bookingModel');
const { findUserById } = require('../auth/userModel');
const { getDriverRatingSummary } = require('../ratings/ratingModel');

/**
 * Error de negocio con codigo HTTP, para que el controlador responda correctamente.
 */
class FavoriteDriverError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Indica si el pasajero ya realizo al menos un viaje (no cancelado y con
 * hora de salida pasada) con ese conductor.
 * US29 - Escenario 01: solo se guarda un conductor de un viaje terminado.
 */
function hasCompletedTripWith(passengerId, driverId, now = Date.now()) {
  return getBookingsByPassenger(passengerId).some((booking) => {
    if (String(booking.driverId) !== String(driverId)) return false;
    if (booking.status === BOOKING_STATUS.CANCELLED) return false;

    const departure = Number(booking.routeSnapshot?.expiresAtTimestamp);
    return Number.isFinite(departure) && departure <= now;
  });
}

/**
 * Datos visibles del conductor: nombre y calificacion.
 * US29 - Escenario 05: mostrar estrellas y datos del conductor.
 */
function buildDriverCard(driverId, savedAt = null) {
  const driver = findUserById(driverId);
  const rating = getDriverRatingSummary(driverId);

  const name = driver
    ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Conductor'
    : 'Conductor no disponible';

  return {
    driverId: String(driverId),
    name,
    vehicle: driver?.vehicle || null,
    rating: rating.average,
    ratingCount: rating.count,
    savedAt,
  };
}

function listFavoriteDrivers(passengerId) {
  return getFavoritesByPassenger(passengerId).map((favorite) =>
    buildDriverCard(favorite.driverId, favorite.savedAt)
  );
}

function saveFavoriteDriver(passengerId, driverId) {
  if (!driverId) {
    throw new FavoriteDriverError('Debes indicar el conductor que quieres guardar.');
  }

  if (String(passengerId) === String(driverId)) {
    throw new FavoriteDriverError('No puedes guardarte a ti mismo como conductor frecuente.');
  }

  if (!findUserById(driverId)) {
    throw new FavoriteDriverError('El conductor no existe.', 404);
  }

  if (!hasCompletedTripWith(passengerId, driverId)) {
    throw new FavoriteDriverError(
      'Solo puedes guardar conductores con los que ya terminaste un viaje.',
      403
    );
  }

  const { created } = addFavorite(passengerId, driverId);

  return { driver: buildDriverCard(driverId), created };
}

function deleteFavoriteDriver(passengerId, driverId) {
  if (!removeFavorite(passengerId, driverId)) {
    throw new FavoriteDriverError('Ese conductor no est\u00e1 en tu lista de frecuentes.', 404);
  }
}

module.exports = {
  FavoriteDriverError,
  hasCompletedTripWith,
  isFavorite,
  listFavoriteDrivers,
  saveFavoriteDriver,
  deleteFavoriteDriver,
};
