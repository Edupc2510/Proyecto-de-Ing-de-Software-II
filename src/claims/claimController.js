// claims/claimController.js
// Controlador HTTP de US37 - Consultar estado del reclamo.
// Solo conoce la Facade; no sabe de DAO, decoradores ni reservas.

const { ReclamoFacade } = require('./claimFacade');
const { handle } = require('../shared/httpHelpers');

const facade = new ReclamoFacade();

// GET /claims?codigo=&estado=&categoria=&desde=AAAA-MM-DD&hasta=AAAA-MM-DD  (todos opcionales)
const listarMisReclamos = handle((req, res) => {
  const { codigo, estado, categoria, desde, hasta } = req.query;
  const data = facade.consultarMisReclamos(req.session.userId, { codigo, estado, categoria, desde, hasta });
  res.status(200).json({ success: true, ...data });
}, 'ClaimController.listar');

// GET /claims/:codigo
const consultarReclamo = handle((req, res) => {
  const reclamo = facade.consultarReclamo(req.session.userId, req.params.codigo);
  res.status(200).json({ success: true, reclamo });
}, 'ClaimController.consultar');

module.exports = { listarMisReclamos, consultarReclamo };
