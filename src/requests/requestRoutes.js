// requests/requestRoutes.js
// Rutas de US15 - Visualizar estado de solicitudes. Montadas en /requests.

const express = require('express');
const router = express.Router();
const { requireSessionJson } = require('../shared/httpHelpers');
const controller = require('./requestController');

router.use(requireSessionJson);

router.get('/', controller.listarMisSolicitudes);
router.get('/:id', controller.verSolicitud);
router.post('/:id/cancel', controller.cancelarSolicitud);

module.exports = router;
