// reservations/reservationController.js
// Controlador HTTP de US17 (ver reservas) y US35 (confirmar participación).

const { ReservaService } = require('./reservationService');
const { handle } = require('../shared/httpHelpers');

const service = new ReservaService();

// GET /reservations?filtro=proximas|pasadas|canceladas|todas
const listarMisReservas = handle((req, res) => {
  const data = service.listar(req.session.userId, req.query.filtro || 'proximas');
  res.status(200).json({ success: true, ...data });
}, 'ReservationController.listar');

// GET /reservations/:id
const verReserva = handle((req, res) => {
  const reserva = service.detalle(req.session.userId, req.params.id);
  res.status(200).json({ success: true, reserva });
}, 'ReservationController.detalle');

// POST /reservations/:id/participation/confirm
const confirmarParticipacion = handle((req, res) => {
  const reserva = service.confirmarParticipacion(req.session.userId, req.params.id);
  res.status(200).json({ success: true, message: '¡Listo! Confirmaste tu participación en el viaje.', reserva });
}, 'ReservationController.confirmar');

// POST /reservations/:id/participation/decline  { motivo? }
const declinarParticipacion = handle((req, res) => {
  const reserva = service.declinarParticipacion(req.session.userId, req.params.id, req.body?.motivo);
  res.status(200).json({ success: true, message: 'Avisamos que no participarás en este viaje.', reserva });
}, 'ReservationController.declinar');

// POST /reservations/:id/participation/undo
const deshacerParticipacion = handle((req, res) => {
  const { reserva, deshecho } = service.deshacerParticipacion(req.session.userId, req.params.id);
  res.status(200).json({ success: true, message: `Se deshizo: "${deshecho}".`, reserva });
}, 'ReservationController.deshacer');

module.exports = { listarMisReservas, verReserva, confirmarParticipacion, declinarParticipacion, deshacerParticipacion };
