// ratings/ratingRoutes.js
// US25 - Rutas para que el conductor califique al pasajero.
//
// Se monta en /ratings junto con las rutas de la US24 (driverRatingRoutes.js).
// Los caminos son distintos (/ratings/driver/... y /ratings/passengers) para que
// ambas historias convivan sin pisarse.

const path = require('path');
const express = require('express');
const { requireAuth, requireApiAuth } = require('../shared/middleware/authMiddleware');
const { crearControlador } = require('./passengerRatingController');

const router = express.Router();
const controlador = crearControlador();

// GET /ratings/driver - vista HTML "Calificar pasajeros"
router.get('/driver', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../views/calificaciones.html'));
});

// GET /ratings/driver/trips - Pasajeros de mis viajes y su estado de calificación
router.get('/driver/trips', requireApiAuth, controlador.viajes);

// POST /ratings/passengers - El conductor califica a un pasajero
router.post('/passengers', requireApiAuth, controlador.calificar);

// GET /ratings/passengers - Calificaciones que el conductor ya envió
router.get('/passengers', requireApiAuth, controlador.emitidas);

// Datos de demostración (deshabilitados en producción)
router.post('/driver/demo', requireApiAuth, controlador.crearDemo);
router.delete('/driver/demo', requireApiAuth, controlador.borrarDemo);

module.exports = router;
