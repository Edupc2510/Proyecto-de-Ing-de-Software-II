// ratings/passengerRatingController.js
// Capa de PRESENTACIÓN (US25): traduce HTTP <-> servicio. Sin lógica de negocio.
// Mismo estilo de respuestas que la US24: listas como arreglo JSON y errores { error }.

const { handle, DomainError } = require('../shared/httpHelpers');
const { CalificacionService } = require('./passengerRatingService');
const { CalificacionPasajeroDAO } = require('./passengerRatingDAO');
const { ReservaViajeAdapter } = require('./bookingTripAdapter');
const { UsuarioRepositorioAdapter } = require('../shared/users/userRepositoryAdapter');
const { generarDatosDemo, limpiarDemo } = require('./demoSeeder');

function crearDependencias() {
  return {
    reservas: new ReservaViajeAdapter(),
    calificaciones: new CalificacionPasajeroDAO(),
    usuarios: new UsuarioRepositorioAdapter(),
  };
}

function crearControlador(deps = crearDependencias()) {
  const service = new CalificacionService(deps);
  const bookingModel = deps.reservas.bookingModel;

  return {
    /** GET /ratings/driver/trips - pasajeros de mis viajes y su estado de calificación */
    viajes: handle((req, res) => {
      res.status(200).json(service.viajesPorCalificar(req.session.userId));
    }, 'PassengerRatings.viajes'),

    /** POST /ratings/passengers  { bookingId, score, comment } */
    calificar: handle((req, res) => {
      const calificacion = service.calificar(req.session.userId, req.body || {});
      res.status(201).json({ message: '¡Gracias! Tu calificación fue registrada.', rating: calificacion });
    }, 'PassengerRatings.calificar'),

    /** GET /ratings/passengers - calificaciones que ya envié */
    emitidas: handle((req, res) => {
      res.status(200).json(service.calificacionesEmitidas(req.session.userId));
    }, 'PassengerRatings.emitidas'),

    /** POST /ratings/driver/demo - datos de prueba (deshabilitado en producción) */
    crearDemo: handle((req, res) => {
      if (process.env.NODE_ENV === 'production') throw new DomainError('No disponible en producción.', 403);
      generarDatosDemo(req.session.userId, { bookingModel, usuarios: deps.usuarios });
      res.status(201).json({ message: 'Datos de demostración generados.' });
    }, 'PassengerRatings.crearDemo'),

    /** DELETE /ratings/driver/demo */
    borrarDemo: handle((req, res) => {
      const eliminado = limpiarDemo(req.session.userId, { bookingModel, calificaciones: deps.calificaciones });
      res.status(200).json({ message: 'Datos de demostración eliminados.', ...eliminado });
    }, 'PassengerRatings.borrarDemo'),
  };
}

module.exports = { crearControlador, crearDependencias };
