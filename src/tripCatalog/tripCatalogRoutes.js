// tripCatalog/tripCatalogRoutes.js
// Montada en /trip-catalog (US27: ordenar por horario · US28: ordenar por asientos).

const express = require('express');
const { requireApiAuth } = require('../shared/middleware/authMiddleware');
const { crearService, crearControlador } = require('./tripCatalogController');
const { AccountFacade } = require('../account/accountFacade');

const router = express.Router();

// La política de visibilidad (cuenta pausada, US32) viene del módulo de cuenta.
const controlador = crearControlador(crearService({ visibilidad: AccountFacade.crearPorDefecto() }));

router.get('/', requireApiAuth, controlador.listar);

module.exports = router;
