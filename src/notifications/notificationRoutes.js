// notifications/notificationRoutes.js

const express = require('express');
const router = express.Router();
const { requireApiAuth } = require('../shared/middleware/authMiddleware');

const {
  listNotifications,
  readNotification,
  readAllNotifications,
  listAlerts,
  addAlert,
  toggleAlert,
  removeAlert,
} = require('./notificationController');

router.use(requireApiAuth);

// Notificaciones del usuario
router.get('/', listNotifications);
router.patch('/read-all', readAllNotifications);
router.patch('/:id/read', readNotification);

// US31 - Rutas habituales (alertas de coincidencia)
router.get('/alerts', listAlerts);
router.post('/alerts', addAlert);
router.patch('/alerts/:id', toggleAlert);
router.delete('/alerts/:id', removeAlert);

module.exports = router;
