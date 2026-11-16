// reservations/reservationRoutes.js
// Rutas de US17 y US35. Montadas en /reservations.

const express = require('express');
const router = express.Router();
const { requireSessionJson } = require('../shared/httpHelpers');
const controller = require('./reservationController');

router.use(requireSessionJson);

// US17 - Visualizar reservas realizadas
router.get('/', controller.listarMisReservas);
router.get('/:id', controller.verReserva);

// US35 - Confirmar participación en el viaje (Command: confirmar / declinar / deshacer)
router.post('/:id/participation/confirm', controller.confirmarParticipacion);
router.post('/:id/participation/decline', controller.declinarParticipacion);
router.post('/:id/participation/undo', controller.deshacerParticipacion);

module.exports = router;
