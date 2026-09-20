// routes/dashboardRoutes.js
// Rutas del dashboard principal

const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboardController');
const { requireAuth } = require('../shared/middleware/authMiddleware');

// GET /dashboard - Renderiza el dashboard (requiere autenticación)
router.get('/', requireAuth, dashboardController.getDashboard);

// GET /dashboard/profile - Retorna datos del perfil en JSON
router.get('/profile', requireAuth, dashboardController.getProfile);

module.exports = router;
