// drivers/frequentDriverController.js
// Controlador HTTP de US30 - Contactar conductores frecuentes.

const { ConductorFrecuenteService, MIN_VIAJES_FRECUENTE } = require('./frequentDriverService');
const { handle } = require('../shared/httpHelpers');

const service = new ConductorFrecuenteService();

function pasajeroDeSesion(req) {
  return { id: req.session.userId, name: req.session.userName || 'un pasajero de MoveShare' };
}

// GET /frequent-drivers
const listarFrecuentes = handle((req, res) => {
  const conductores = service.listar(req.session.userId);
  res.status(200).json({ success: true, minimoViajes: MIN_VIAJES_FRECUENTE, conductores });
}, 'FrequentDriverController.listar');

// POST /frequent-drivers/:driverId/contact  { canal, mensaje? }
const contactarConductor = handle((req, res) => {
  const resultado = service.contactar(pasajeroDeSesion(req), req.params.driverId, req.body?.canal, req.body?.mensaje);
  const message = resultado.tipo === 'mensaje' ? 'Mensaje enviado al conductor.' : `Abriendo ${resultado.etiqueta}...`;
  res.status(200).json({ success: true, message, contacto: resultado });
}, 'FrequentDriverController.contactar');

// GET /frequent-drivers/:driverId/contacts
const historialContactos = handle((req, res) => {
  const data = service.historial(req.session.userId, req.params.driverId);
  res.status(200).json({ success: true, ...data });
}, 'FrequentDriverController.historial');

module.exports = { listarFrecuentes, contactarConductor, historialContactos };
