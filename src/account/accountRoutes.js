// account/accountRoutes.js
// Montada en /account (US19: editar perfil · US32: gestión avanzada de cuenta).

const path = require('path');
const express = require('express');
const { requireAuth, requireApiAuth } = require('../shared/middleware/authMiddleware');
const { AccountFacade } = require('./accountFacade');
const { crearControlador } = require('./accountController');

const router = express.Router();
const controlador = crearControlador(AccountFacade.crearPorDefecto());

// GET /account - vista HTML "Mi cuenta"
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../views/cuenta.html'));
});

// US19
router.get('/profile', requireApiAuth, controlador.obtenerPerfil);
router.put('/profile', requireApiAuth, controlador.actualizarPerfil);

// US32
router.get('/settings', requireApiAuth, controlador.obtenerAjustes);
router.put('/settings', requireApiAuth, controlador.actualizarAjustes);

// Perfil visible para otros usuarios (respeta privacidad y pausa de cuenta)
router.get('/public/:userId', requireApiAuth, controlador.perfilPublico);

module.exports = router;
