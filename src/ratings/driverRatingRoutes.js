// ratings/driverRatingRoutes.js
// US24 - Rutas para que el pasajero califique al conductor.
//
// Se monta en /ratings junto con las rutas de la US25 (ratingRoutes.js),
// que usan /ratings/driver/trips y /ratings/passengers. Los caminos de aquí
// son distintos para que ambas historias convivan sin pisarse.

const express = require('express');
const router = express.Router();
const { requireApiAuth } = require('../shared/middleware/authMiddleware');
const { getMyTripsToRate, rateDriver, getDriverSummary } = require('./driverRatingController');

// GET /ratings/passenger/trips - Viajes del pasajero y su estado de calificación
router.get('/passenger/trips', requireApiAuth, getMyTripsToRate);

// POST /ratings/drivers - El pasajero califica al conductor
router.post('/drivers', requireApiAuth, rateDriver);

// GET /ratings/drivers/:driverId/summary - Reputación del conductor
router.get('/drivers/:driverId/summary', requireApiAuth, getDriverSummary);

module.exports = router;
