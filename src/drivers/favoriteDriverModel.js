// src/drivers/favoriteDriverModel.js
// US29 - Persistencia de los conductores frecuentes (favoritos) de cada pasajero
// en data/favoriteDrivers.json.

const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('favoriteDrivers.json');

const getFavorites = () => store.read();
const saveFavorites = (favorites) => store.write(favorites);

const isSameFavorite = (favorite, passengerId, driverId) =>
  favorite.passengerId === String(passengerId) && favorite.driverId === String(driverId);

/**
 * Conductores guardados por un pasajero (del mas reciente al mas antiguo).
 */
function getFavoritesByPassenger(passengerId) {
  return getFavorites()
    .filter((favorite) => favorite.passengerId === String(passengerId))
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

function isFavorite(passengerId, driverId) {
  return getFavorites().some((favorite) => isSameFavorite(favorite, passengerId, driverId));
}

/**
 * Guarda un conductor en la lista del pasajero.
 * US29 - Escenario 04: si ya estaba guardado, no se duplica.
 * @returns {{ favorite: object, created: boolean }}
 */
function addFavorite(passengerId, driverId) {
  const favorites = getFavorites();
  const existing = favorites.find((favorite) => isSameFavorite(favorite, passengerId, driverId));

  if (existing) return { favorite: existing, created: false };

  const favorite = {
    passengerId: String(passengerId),
    driverId: String(driverId),
    savedAt: new Date().toISOString(),
  };

  favorites.push(favorite);

  if (!saveFavorites(favorites)) {
    throw new Error('No se pudo guardar el conductor frecuente.');
  }

  return { favorite, created: true };
}

/**
 * US29 - Escenario 02: retira un conductor de la lista del pasajero.
 * @returns {boolean} true si se elimino
 */
function removeFavorite(passengerId, driverId) {
  const favorites = getFavorites();
  const remaining = favorites.filter((favorite) => !isSameFavorite(favorite, passengerId, driverId));

  if (remaining.length === favorites.length) return false;

  if (!saveFavorites(remaining)) {
    throw new Error('No se pudo eliminar el conductor frecuente.');
  }

  return true;
}

module.exports = {
  getFavoritesByPassenger,
  isFavorite,
  addFavorite,
  removeFavorite,
};
