const express = require('express');
const path = require('node:path');
const { findUserById } = require('../auth/userModel');
const { ReportService, ReportError } = require('./reportService');
const { TripAccessRepository } = require('../trips/tripAccessRepository');

function createReportRouter(service = new ReportService()) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session?.userId) return res.status(401).json({ error: 'Inicia sesión para reportar un viaje.' });
    next();
  });
  router.get('/new', (req, res) => res.sendFile(path.join(__dirname, '../../views/report_incident.html')));
  router.get('/trips', (req, res) => {
    try { res.json(new TripAccessRepository().getForUser(req.session.userId)); }
    catch { res.status(500).json({ error: 'No se pudieron cargar tus viajes.' }); }
  });
  router.post('/', async (req, res) => {
    try {
      const user = findUserById(req.session.userId);
      if (!user) return res.status(401).json({ error: 'Inicia sesión nuevamente.' });
      const result = await service.register(user, req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(error instanceof ReportError ? error.status : 500).json({
        error: error instanceof ReportError ? error.message : 'No se pudo registrar el reclamo. Intenta nuevamente.',
      });
    }
  });
  return router;
}
module.exports = { createReportRouter };
