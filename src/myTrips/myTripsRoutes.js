// myTrips/myTripsRoutes.js
// Página "Mis viajes" del pasajero, que agrupa US15, US17, US30, US35 y US37.
// Montada en /mis-viajes.

const express = require('express');
const path = require('path');
const router = express.Router();
const { requireAuth } = require('../shared/middleware/authMiddleware');
const { requireSessionJson, handle, DomainError } = require('../shared/httpHelpers');
const { generarDatosDemo, limpiarDemo } = require('./demoSeeder');

// GET /mis-viajes - vista HTML
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../views/mis_viajes.html'));
});

// POST /mis-viajes/demo - genera datos de demostración (no disponible en producción)
router.post('/demo', requireSessionJson, handle((req, res) => {
  if (process.env.NODE_ENV === 'production') throw new DomainError('No disponible en producción.', 403);
  generarDatosDemo(req.session.userId);
  res.status(201).json({ success: true, message: 'Datos de demostración generados.' });
}, 'MyTrips.demo'));

// DELETE /mis-viajes/demo - elimina los datos de demostración del usuario
router.delete('/demo', requireSessionJson, handle((req, res) => {
  limpiarDemo(req.session.userId);
  res.status(200).json({ success: true, message: 'Datos de demostración eliminados.' });
}, 'MyTrips.demoLimpiar'));

module.exports = router;
