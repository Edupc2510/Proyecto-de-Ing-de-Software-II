// src/drivers/favoriteDriverRoutes.js
// US29 - Rutas de conductores frecuentes. Montadas en /favorite-drivers.

const express = require('express');
const router = express.Router();

const {
  getMyFavoriteDrivers,
  addFavoriteDriver,
  removeFavoriteDriver,
} = require('./favoriteDriverController');

router.get('/', getMyFavoriteDrivers);
router.post('/', addFavoriteDriver);
router.delete('/:driverId', removeFavoriteDriver);

module.exports = router;
