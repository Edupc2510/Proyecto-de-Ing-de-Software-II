// PRUEBA DE CAJA BLANCA (US25) · CalificacionService.calificar() · passengerRatingService.js L38-59
// Camino básico: V(G)=7 -> 7 caminos independientes. Cada caso verifica el resultado y la traza de colaboradores.
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');
const { CalificacionService } = require('../src/ratings/passengerRatingService');
const { ReservaViajeAdapter } = require('../src/ratings/bookingTripAdapter');

const AHORA = Date.parse('2026-11-15T12:00:00Z');
const HORA = 3600e3;
const usuarios = { buscarPorId: id => (['cond', 'p1'].includes(String(id)) ? { id: String(id), firstName: 'N', lastName: 'A' } : null) };
const reserva = (extra = {}) => ({
  id: 'b1', routeId: 'r1', driverId: 'cond', passengerId: 'p1', status: 'confirmada',
  routeSnapshot: { origin: 'Ate', dest: 'Surco', time: '08:00', expiresAtTimestamp: AHORA - HORA }, ...extra,
});

function armar({ reservas = [reserva()], duplicada = null } = {}) {
  const traza = [];
  const bookingModel = {
    BOOKING_STATUS: { CONFIRMED: 'confirmada', CANCELLED: 'cancelada' },
    getBookings: () => reservas,
    findBookingById: id => reservas.find(b => b.id === String(id)) || null,
  };
  const ad = new ReservaViajeAdapter({ bookingModel });
  const reservasEspia = {
    buscarReserva: id => { traza.push('buscarReserva'); return ad.buscarReserva(id); },
    estaConfirmada: r => { traza.push('estaConfirmada'); return ad.estaConfirmada(r); },
    haTerminado: (r, ahora) => { traza.push('haTerminado'); return ad.haTerminado(r, ahora); },
  };
  const usuariosEspia = { buscarPorId: id => { traza.push('buscarPorId'); return usuarios.buscarPorId(id); } };
  const guardadas = [];
  const calificaciones = {
    buscarDuplicada: () => { traza.push('buscarDuplicada'); return duplicada; },
    guardar: c => { traza.push('guardar'); guardadas.push(c); return c; },
  };
  return { service: new CalificacionService({ reservas: reservasEspia, calificaciones, usuarios: usuariosEspia, reloj: () => AHORA }), traza, guardadas };
}
const fallo = fn => { try { fn(); } catch (e) { return e; } assert.fail('Se esperaba un error'); };

test('CB-01 · camino 1-2-4-14 · la reserva no existe -> 404', () => {
  const { service, traza, guardadas } = armar({ reservas: [] });
  const e = fallo(() => service.calificar('cond', { bookingId: 'x', score: 4 }));
  assert.strictEqual(e.status, 404); assert.match(e.message, /No encontramos esa reserva/);
  assert.deepStrictEqual(traza, ['buscarReserva']); assert.strictEqual(guardadas.length, 0);
});
test('CB-02 · camino 1-2-3-4-14 · la reserva es de otro conductor -> 404', () => {
  const { service, traza, guardadas } = armar({ reservas: [reserva({ driverId: 'otro' })] });
  const e = fallo(() => service.calificar('cond', { bookingId: 'b1', score: 4 }));
  assert.strictEqual(e.status, 404); assert.deepStrictEqual(traza, ['buscarReserva']); assert.strictEqual(guardadas.length, 0);
});
test('CB-03 · camino 1-2-3-5-6-14 · el pasajero no existe -> 404', () => {
  const { service, traza, guardadas } = armar({ reservas: [reserva({ passengerId: 'fantasma' })] });
  const e = fallo(() => service.calificar('cond', { bookingId: 'b1', score: 4 }));
  assert.strictEqual(e.status, 404); assert.strictEqual(e.message, 'El pasajero no existe.');
  assert.deepStrictEqual(traza, ['buscarReserva', 'buscarPorId']); assert.strictEqual(guardadas.length, 0);
});
test('CB-04 · camino 1-2-3-5-7-8-14 · reserva cancelada -> 409', () => {
  const { service, traza, guardadas } = armar({ reservas: [reserva({ status: 'cancelada' })] });
  const e = fallo(() => service.calificar('cond', { bookingId: 'b1', score: 4 }));
  assert.strictEqual(e.status, 409); assert.match(e.message, /reserva fue cancelada/);
  assert.deepStrictEqual(traza, ['buscarReserva', 'buscarPorId', 'estaConfirmada']); assert.strictEqual(guardadas.length, 0);
});
test('CB-05 · camino 1-2-3-5-7-9-10-14 · el viaje aún no termina -> 409', () => {
  const futura = reserva({ routeSnapshot: { origin: 'A', dest: 'B', time: '23:00', expiresAtTimestamp: AHORA + HORA } });
  const { service, traza, guardadas } = armar({ reservas: [futura] });
  const e = fallo(() => service.calificar('cond', { bookingId: 'b1', score: 4 }));
  assert.strictEqual(e.status, 409); assert.match(e.message, /cuando el viaje haya finalizado/);
  assert.deepStrictEqual(traza, ['buscarReserva', 'buscarPorId', 'estaConfirmada', 'haTerminado']); assert.strictEqual(guardadas.length, 0);
});
test('CB-06 · camino 1-2-3-5-7-9-11-12-14 · ya calificó a ese pasajero por ese viaje -> 409', () => {
  const { service, traza, guardadas } = armar({ duplicada: { id: 'previa', score: 5 } });
  const e = fallo(() => service.calificar('cond', { bookingId: 'b1', score: 4 }));
  assert.strictEqual(e.status, 409); assert.strictEqual(e.message, 'Ya calificaste a este pasajero por este viaje.');
  assert.deepStrictEqual(traza, ['buscarReserva', 'buscarPorId', 'estaConfirmada', 'haTerminado', 'buscarDuplicada']); assert.strictEqual(guardadas.length, 0);
});
test('CB-07 · camino 1-2-3-5-7-9-11-13-14 · calificación exitosa -> se guarda', () => {
  const { service, traza, guardadas } = armar();
  const r = service.calificar('cond', { bookingId: 'b1', score: 5, comment: ' Puntual ' });
  assert.deepStrictEqual(traza, ['buscarReserva', 'buscarPorId', 'estaConfirmada', 'haTerminado', 'buscarDuplicada', 'guardar']);
  assert.strictEqual(guardadas.length, 1); assert.strictEqual(r.rateeRole, 'passenger');
  assert.strictEqual(r.rateeId, 'p1'); assert.strictEqual(r.score, 5); assert.strictEqual(r.comment, 'Puntual');
});
test('CB-08 (complementario) · la validación de entrada falla antes de consultar nada -> 400', () => {
  const { service, traza } = armar();
  const e = fallo(() => service.calificar('cond', { bookingId: 'b1', score: 9 }));
  assert.strictEqual(e.status, 400); assert.deepStrictEqual(traza, []);
});
