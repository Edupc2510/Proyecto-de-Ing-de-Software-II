// tests/ratings.test.js - US25 (el conductor califica al pasajero después del viaje)
// Service + DAO + Adapter. Usa la MISMA regla de "viaje finalizado" que la US24
// y el mismo archivo ratings.json (formato genérico). Las reservas se simulan
// con un bookingModel en memoria (DIP): no se toca data/bookings.json.
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { CalificacionService } = require('../src/ratings/passengerRatingService');
const { CalificacionPasajeroDAO } = require('../src/ratings/passengerRatingDAO');
const { ReservaViajeAdapter } = require('../src/ratings/bookingTripAdapter');
const { generarDatosDemo, limpiarDemo } = require('../src/ratings/demoSeeder');
const { JsonDAO } = require('../src/shared/persistence/JsonDAO');

const AHORA = Date.parse('2026-11-15T12:00:00Z');
const HORA = 3600e3;

const usuarios = {
  lista: [
    { id: 'cond', firstName: 'Carla', lastName: 'Conductora', verified: true },
    { id: 'p1', firstName: 'Pedro', lastName: 'Pasajero', verified: true },
    { id: 'p2', firstName: 'Paula', lastName: 'Pasajera', verified: true },
  ],
  buscarPorId(id) { return this.lista.find(u => u.id === String(id)) || null; },
  listar() { return this.lista; },
};

/** bookingModel en memoria con la misma interfaz que trips/bookingModel */
function bookingModelEnMemoria(reservas = []) {
  const modelo = {
    BOOKING_STATUS: { CONFIRMED: 'confirmada', CANCELLED: 'cancelada' },
    lista: reservas,
    getBookings: () => modelo.lista,
    saveBookings: nuevas => { modelo.lista = nuevas; return true; },
    findBookingById: id => modelo.lista.find(b => b.id === String(id)) || null,
  };
  return modelo;
}

let contador = 0;
const reserva = (extra = {}) => {
  contador += 1;
  return {
    id: `b${contador}`, routeId: `r${contador}`, driverId: 'cond', passengerId: 'p1', status: 'confirmada',
    routeSnapshot: { origin: 'A', dest: 'B', time: '08:00', expiresAtTimestamp: AHORA - HORA }, // salió hace 1 h
    createdAt: new Date(AHORA - 2 * HORA).toISOString(),
    ...extra,
  };
};

function escenario(reservas = [reserva()], calificaciones = new CalificacionPasajeroDAO()) {
  const bookingModel = bookingModelEnMemoria(reservas);
  const service = new CalificacionService({
    reservas: new ReservaViajeAdapter({ bookingModel }), // usa la regla real isTripFinished de la US24
    calificaciones, usuarios, reloj: () => AHORA,
  });
  return { service, bookingModel, calificaciones, reserva: reservas[0] };
}
const error = fn => { try { fn(); } catch (e) { return `${e.status}|${e.message}`; } assert.fail('Se esperaba un error'); };
const delViaje = (calificaciones, r) => calificaciones.buscar(c => c.bookingId === r.id);

test('US25 esc.01: calificación exitosa se guarda con el formato genérico compartido con la US24', () => {
  const { service, reserva: r, calificaciones } = escenario();
  const guardada = service.calificar('cond', { bookingId: r.id, score: 5, comment: ' Puntual y amable ' });

  assert.strictEqual(guardada.rateeRole, 'passenger');
  assert.strictEqual(guardada.raterId, 'cond');
  assert.strictEqual(guardada.rateeId, 'p1');
  assert.strictEqual(guardada.routeId, r.routeId);
  assert.strictEqual(guardada.score, 5);
  assert.strictEqual(guardada.comment, 'Puntual y amable');
  assert.strictEqual(delViaje(calificaciones, r).length, 1);
});

test('US25: se puede visualizar el estado de cada pasajero y el historial emitido', () => {
  const terminada = reserva();
  const enCurso = reserva({ passengerId: 'p2', routeSnapshot: { origin: 'C', dest: 'D', time: '23:00', expiresAtTimestamp: AHORA + HORA } });
  const cancelada = reserva({ status: 'cancelada' });
  const { service } = escenario([terminada, enCurso, cancelada]);

  service.calificar('cond', { bookingId: terminada.id, score: 4 });
  const viajes = service.viajesPorCalificar('cond');

  assert.strictEqual(viajes.length, 2); // la reserva cancelada no aparece
  assert.deepStrictEqual(viajes.map(v => v.ratingStatus), ['en_curso', 'calificado']);
  assert.strictEqual(viajes.find(v => v.bookingId === terminada.id).rating.score, 4);
  assert.strictEqual(viajes.find(v => v.bookingId === terminada.id).passengerName, 'Pedro Pasajero');
  assert.strictEqual(service.calificacionesEmitidas('cond').find(c => c.bookingId === terminada.id).passengerName, 'Pedro Pasajero');
});

test('US25 esc.02: si el pasajero no existe se muestra error y no se guarda nada', () => {
  const { service, reserva: r, calificaciones } = escenario([reserva({ passengerId: 'fantasma' })]);
  assert.strictEqual(error(() => service.calificar('cond', { bookingId: r.id, score: 4 })), '404|El pasajero no existe.');
  assert.strictEqual(delViaje(calificaciones, r).length, 0);
});

test('US25 esc.03: valores inválidos se rechazan (fuera de rango, decimales, texto, vacío)', () => {
  const { service, reserva: r, calificaciones } = escenario();
  for (const score of [0, 6, 3.5, '5', null, undefined, NaN]) {
    assert.match(error(() => service.calificar('cond', { bookingId: r.id, score })), /^400\|La calificación debe ser un número entero entre 1 y 5\./);
  }
  assert.match(error(() => service.calificar('cond', { bookingId: r.id, score: 4, comment: 'x'.repeat(301) })), /^400\|El comentario/);
  assert.match(error(() => service.calificar('cond', { score: 4 })), /^400\|No se indicó el viaje/);
  assert.strictEqual(delViaje(calificaciones, r).length, 0);
});

test('US25 esc.04: no permite calificar dos veces al mismo pasajero por el mismo viaje', () => {
  const { service, reserva: r, calificaciones } = escenario();
  service.calificar('cond', { bookingId: r.id, score: 4 });
  assert.strictEqual(error(() => service.calificar('cond', { bookingId: r.id, score: 5 })), '409|Ya calificaste a este pasajero por este viaje.');
  assert.strictEqual(delViaje(calificaciones, r).length, 1);
});

test('US25 esc.05: si falla el guardado (error de red/disco) no queda ninguna calificación', () => {
  const guardadas = [];
  const rotas = { buscarDuplicada: () => null, listarEmitidas: () => guardadas, guardar: () => { throw new Error('No se pudo guardar la información'); } };
  const { service, reserva: r } = escenario([reserva()], rotas);
  assert.throws(() => service.calificar('cond', { bookingId: r.id, score: 5 }), /No se pudo guardar/);
  assert.strictEqual(guardadas.length, 0);
});

test('US25: solo se califica a un pasajero de una reserva propia, confirmada y de un viaje ya terminado', () => {
  const ajena = reserva({ driverId: 'otro-conductor' });
  const cancelada = reserva({ status: 'cancelada' });
  const futura = reserva({ routeSnapshot: { origin: 'A', dest: 'B', time: '23:00', expiresAtTimestamp: AHORA + HORA } });
  const { service } = escenario([ajena, cancelada, futura]);

  assert.match(error(() => service.calificar('cond', { bookingId: ajena.id, score: 3 })), /^404\|No encontramos esa reserva/);
  assert.match(error(() => service.calificar('cond', { bookingId: 'no-existe', score: 3 })), /^404\|No encontramos esa reserva/);
  assert.match(error(() => service.calificar('cond', { bookingId: cancelada.id, score: 3 })), /^409\|No puedes calificar a un pasajero cuya reserva fue cancelada/);
  assert.match(error(() => service.calificar('cond', { bookingId: futura.id, score: 3 })), /^409\|Solo puedes calificar al pasajero cuando el viaje haya finalizado/);
});

test('DAO: comparte ratings.json con la US24 sin pisar sus calificaciones (rateeRole distinto)', () => {
  const dao = new CalificacionPasajeroDAO();
  const compartido = new (class extends JsonDAO { constructor() { super('ratings.json'); } })();
  compartido.guardar({ id: 'us24', routeId: 'rX', raterId: 'p1', rateeId: 'cond', rateeRole: 'driver', score: 5 }); // formato US24

  const { service, reserva: r } = escenario([reserva()], dao);
  service.calificar('cond', { bookingId: r.id, score: 3 });

  assert.ok(compartido.buscarPorId('us24'), 'la calificación de la US24 sigue ahí');
  assert.ok(dao.listarEmitidas('cond').every(c => c.rateeRole === 'passenger'), 'la US25 solo ve las suyas');
  assert.strictEqual(dao.buscarDuplicada({ routeId: 'rX', driverId: 'p1', passengerId: 'cond' }), null);
});

test('Adapter: ReservaViajeAdapter traduce bookingModel y reutiliza la regla de viaje finalizado de la US24', () => {
  const propia = reserva();
  const ajena = reserva({ driverId: 'otro' });
  const bookingModel = bookingModelEnMemoria([propia, ajena]);
  const adapter = new ReservaViajeAdapter({ bookingModel });

  assert.deepStrictEqual(adapter.listarDelConductor('cond').map(b => b.id), [propia.id]);
  assert.strictEqual(adapter.buscarReserva(ajena.id).driverId, 'otro');
  assert.strictEqual(adapter.estaConfirmada(propia), true);
  assert.strictEqual(adapter.haTerminado(propia, AHORA), true);
  assert.strictEqual(adapter.haTerminado(propia, AHORA - 2 * HORA), false);
});

test('Datos de demostración: se generan para el conductor y se eliminan sin tocar datos reales', () => {
  const real = reserva();
  const bookingModel = bookingModelEnMemoria([real]);
  const calificaciones = new CalificacionPasajeroDAO();

  const creadas = generarDatosDemo('cond', { bookingModel, usuarios, reloj: () => AHORA });
  assert.strictEqual(creadas.length, 4); // 2 viajes terminados x 2 pasajeros (solo hay 2 usuarios además del conductor)
  assert.ok(creadas.every(b => b.demo === true && b.passengerId !== 'cond' && b.status === 'confirmada'));

  const service = new CalificacionService({ reservas: new ReservaViajeAdapter({ bookingModel }), calificaciones, usuarios, reloj: () => AHORA });
  service.calificar('cond', { bookingId: creadas[0].id, score: 5 }); // las demo ya cuentan como viajes terminados

  const resumen = limpiarDemo('cond', { bookingModel, calificaciones });
  assert.deepStrictEqual(resumen, { reservas: 4, calificaciones: 1 });
  assert.deepStrictEqual(bookingModel.getBookings().map(b => b.id), [real.id], 'no borra reservas reales');
  assert.throws(() => generarDatosDemo('cond', { bookingModel, usuarios: { listar: () => [] } }), /No hay otros usuarios/);
});
