// claims/claimController.js
// Controlador HTTP de US37 - Consultar estado del reclamo.
// Solo conoce la Facade; no sabe de DAO, decoradores ni reservas.

const { ReclamoFacade } = require('./claimFacade');
const { handle } = require('../shared/httpHelpers');

const facade = new ReclamoFacade();

// GET /claims?estado=registrado|en_revision|en_proceso|resuelto|rechazado|cerrado|todos
const listarMisReclamos = handle((req, res) => {
  const data = facade.consultarMisReclamos(req.session.userId, { estado: req.query.estado });
  res.status(200).json({ success: true, ...data });
}, 'ClaimController.listar');

// GET /claims/:codigo
const consultarReclamo = handle((req, res) => {
  const reclamo = facade.consultarReclamo(req.session.userId, req.params.codigo);
  res.status(200).json({ success: true, reclamo });
}, 'ClaimController.consultar');

module.exports = { listarMisReclamos, consultarReclamo };
