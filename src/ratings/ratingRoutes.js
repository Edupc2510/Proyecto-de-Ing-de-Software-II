// ratings/ratingRoutes.js

const express = require('express');
const router = express.Router();
const { requireApiAuth } = require('../shared/middleware/authMiddleware');
const { getMyTripsToRate, rateDriver, getDriverSummary } = require('./ratingController');

router.use(requireApiAuth);

// US24 - Viajes del pasajero y su estado de calificación
router.get('/trips', getMyTripsToRate);

// US24 - Registrar calificación al conductor
router.post('/', rateDriver);

// Reputación del conductor
router.get('/driver/:driverId', getDriverSummary);

module.exports = router;
