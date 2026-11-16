const express = require('express');
const path = require('node:path');
const { PasswordResetService, RecoveryError } = require('./passwordResetService');

function createPasswordResetRouter(service = new PasswordResetService()) {
  const router = express.Router();
  const attempts = new Map();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  // Límite por IP en memoria local, igual que las sesiones del MVP.
  function limitRequests(req, res, next) {
    const now = Date.now();
    for (const [ip, value] of attempts) {
      if (value.until <= now) attempts.delete(ip);
    }
    const value = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
    value.count += 1;
    attempts.set(req.ip, value);
    if (value.count > 10) return res.status(429).json({ success: false, message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
    next();
  }
  function handleError(error, res) {
    if (error instanceof RecoveryError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('[US20] No se pudo completar la operación.');
    return res.status(500).json({ success: false, message: 'No se pudo completar la operación. Intenta nuevamente.' });
  }
  router.get(['/forgot-password', '/reset-password'], (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/password_recovery.html'));
  });
  router.post('/forgot-password', limitRequests, async (req, res) => {
    try {
      const message = await service.requestReset(req.body?.email);
      res.json({ success: true, message });
    } catch (error) { handleError(error, res); }
  });
  router.post('/reset-password', limitRequests, async (req, res) => {
    try {
      const { token, password, confirmation } = req.body || {};
      const message = await service.resetPassword(token, password, confirmation);
      res.json({ success: true, message });
    } catch (error) { handleError(error, res); }
  });
  return router;
}

module.exports = { createPasswordResetRouter };
