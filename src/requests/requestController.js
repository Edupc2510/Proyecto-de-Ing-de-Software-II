// requests/requestController.js
// Controlador HTTP de US15 - Visualizar estado de solicitudes.

const { SolicitudService } = require('./requestService');
const { handle } = require('../shared/httpHelpers');

const service = new SolicitudService();

// GET /requests?estado=pendiente|aceptada|rechazada|cancelada|expirada|todas
const listarMisSolicitudes = handle((req, res) => {
  const data = service.listar(req.session.userId, { estado: req.query.estado });
  res.status(200).json({ success: true, ...data });
}, 'RequestController.listar');

// GET /requests/:id
const verSolicitud = handle((req, res) => {
  const solicitud = service.detalle(req.session.userId, req.params.id);
  res.status(200).json({ success: true, solicitud });
}, 'RequestController.detalle');

// POST /requests/:id/cancel
const cancelarSolicitud = handle((req, res) => {
  const solicitud = service.cancelar(req.session.userId, req.params.id);
  res.status(200).json({ success: true, message: 'Solicitud cancelada.', solicitud });
}, 'RequestController.cancelar');

module.exports = { listarMisSolicitudes, verSolicitud, cancelarSolicitud };
