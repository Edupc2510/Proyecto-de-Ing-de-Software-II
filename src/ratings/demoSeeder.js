// ratings/demoSeeder.js
// Datos de demostración para probar la US25 sin esperar a que pase la hora de
// salida de un viaje real: crea reservas CONFIRMADAS de viajes ya terminados,
// donde el usuario en sesión fue conductor y otros usuarios registrados fueron
// sus pasajeros. Todo queda marcado con demo: true para poder borrarlo sin
// tocar datos reales. Usa los mismos módulos del equipo (bookingModel), no
// formatos propios.

const { v4: uuidv4 } = require('uuid');
const { DomainError } = require('../shared/httpHelpers');
const { ROLE_PASSENGER } = require('./passengerRatingRecord');

const HORA_MS = 3600e3;

const hhmm = fecha => `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;

/**
 * @param {string} driverId
 * @param {{ bookingModel: object, usuarios: object, reloj?: Function }} deps
 * @returns {Array} reservas de demostración creadas
 */
function generarDatosDemo(driverId, { bookingModel, usuarios, reloj = Date.now }) {
  const pasajeros = usuarios.listar()
    .filter(u => String(u.id) !== String(driverId) && u.verified !== false)
    .slice(0, 3);

  if (pasajeros.length === 0) {
    throw new DomainError('No hay otros usuarios registrados para generar datos de demostración.', 422);
  }

  const ahora = reloj();
  const viajes = [
    { origin: 'Universidad de Lima, Santiago de Surco', dest: 'Miraflores', horas: 3, pasajeros },
    { origin: 'San Miguel', dest: 'Universidad de Lima, Santiago de Surco', horas: 26, pasajeros: pasajeros.slice(0, 2) },
  ];

  const nuevas = viajes.flatMap(viaje => {
    const salida = new Date(ahora - viaje.horas * HORA_MS);
    const routeId = `demo-${uuidv4()}`;
    return viaje.pasajeros.map(pasajero => ({
      id: uuidv4(),
      routeId,
      driverId: String(driverId),
      passengerId: String(pasajero.id),
      status: bookingModel.BOOKING_STATUS.CONFIRMED,
      routeSnapshot: { origin: viaje.origin, dest: viaje.dest, time: hhmm(salida), expiresAtTimestamp: salida.getTime() },
      createdAt: new Date(salida.getTime() - HORA_MS).toISOString(),
      demo: true,
    }));
  });

  if (!bookingModel.saveBookings([...bookingModel.getBookings(), ...nuevas])) {
    throw new Error('No se pudieron guardar las reservas de demostración.');
  }
  return nuevas;
}

/** Elimina las reservas de demostración del conductor y las calificaciones asociadas. */
function limpiarDemo(driverId, { bookingModel, calificaciones }) {
  const todas = bookingModel.getBookings();
  const demos = todas.filter(b => b.demo === true && b.driverId === String(driverId));
  const ids = new Set(demos.map(b => b.id));

  const calificacionesEliminadas = calificaciones.eliminarDonde(c =>
    c.rateeRole === ROLE_PASSENGER && c.raterId === String(driverId) && ids.has(c.bookingId)
  );
  if (demos.length > 0 && !bookingModel.saveBookings(todas.filter(b => !ids.has(b.id)))) {
    throw new Error('No se pudieron eliminar las reservas de demostración.');
  }
  return { reservas: demos.length, calificaciones: calificacionesEliminadas };
}

module.exports = { generarDatosDemo, limpiarDemo };
