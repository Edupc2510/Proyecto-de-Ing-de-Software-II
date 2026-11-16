// src/drivers/favoriteDriverController.js
// US29 - Endpoints de conductores frecuentes del pasajero.

const {
  FavoriteDriverError,
  listFavoriteDrivers,
  saveFavoriteDriver,
  deleteFavoriteDriver,
} = require('./favoriteDriverService');

function getPassengerId(req, res) {
  const passengerId = req.session?.userId || null;

  if (!passengerId) {
    res.status(401).json({ error: 'Debes iniciar sesi\u00f3n.' });
    return null;
  }

  return passengerId;
}

function handleError(res, error, context) {
  if (error instanceof FavoriteDriverError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(`Error en ${context}:`, error);
  return res.status(500).json({ error: 'Ocurri\u00f3 un problema. Int\u00e9ntalo de nuevo.' });
}

/**
 * GET /favorite-drivers
 * US29 - Escenarios 03 y 05: lista de conductores guardados (puede estar vacia).
 */
const getMyFavoriteDrivers = (req, res) => {
  const passengerId = getPassengerId(req, res);
  if (!passengerId) return;

  try {
    const drivers = listFavoriteDrivers(passengerId);
    return res.status(200).json({ drivers, total: drivers.length });
  } catch (error) {
    return handleError(res, error, 'getMyFavoriteDrivers');
  }
};

/**
 * POST /favorite-drivers   body: { driverId }
 * US29 - Escenarios 01 y 04: guardar un conductor (sin duplicados).
 */
const addFavoriteDriver = (req, res) => {
  const passengerId = getPassengerId(req, res);
  if (!passengerId) return;

  try {
    const { driver, created } = saveFavoriteDriver(passengerId, req.body?.driverId);

    return res.status(created ? 201 : 200).json({
      message: created
        ? 'Conductor guardado en tus frecuentes.'
        : 'Este conductor ya estaba en tus frecuentes.',
      driver,
      created,
    });
  } catch (error) {
    return handleError(res, error, 'addFavoriteDriver');
  }
};

/**
 * DELETE /favorite-drivers/:driverId
 * US29 - Escenario 02: eliminar un conductor de la lista.
 */
const removeFavoriteDriver = (req, res) => {
  const passengerId = getPassengerId(req, res);
  if (!passengerId) return;

  try {
    deleteFavoriteDriver(passengerId, req.params.driverId);
    return res.status(200).json({ message: 'Conductor eliminado de tus frecuentes.' });
  } catch (error) {
    return handleError(res, error, 'removeFavoriteDriver');
  }
};

module.exports = {
  getMyFavoriteDrivers,
  addFavoriteDriver,
  removeFavoriteDriver,
};
