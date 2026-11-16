// drivers/frequentDriverRoutes.js
// Rutas de US30. Montadas en /frequent-drivers.

const express = require('express');
const router = express.Router();
const { requireSessionJson } = require('../shared/httpHelpers');
const controller = require('./frequentDriverController');

router.use(requireSessionJson);

router.get('/', controller.listarFrecuentes);
router.post('/:driverId/contact', controller.contactarConductor);
router.get('/:driverId/contacts', controller.historialContactos);

module.exports = router;
