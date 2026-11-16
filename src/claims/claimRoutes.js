// claims/claimRoutes.js
// Rutas de US37. Montadas en /claims.

const express = require('express');
const router = express.Router();
const { requireSessionJson } = require('../shared/httpHelpers');
const controller = require('./claimController');

router.use(requireSessionJson);

router.get('/', controller.listarMisReclamos);
router.get('/:codigo', controller.consultarReclamo);

module.exports = router;
