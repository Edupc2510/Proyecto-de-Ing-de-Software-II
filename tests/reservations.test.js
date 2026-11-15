// tests/reservations.test.js - US17 (Strategy + Iterator + Adapter) y US35 (Command)
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { ReservaDAO } = require('../src/reservations/reservationDAO');
const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { ReservaService } = require('../src/reservations/reservationService');
const { ColeccionReservas } = require('../src/reservations/reservationCollection');
const { obtenerFiltro } = require('../src/reservations/reservationFilters');
const { BookingAdapter } = require('../src/reservations/bookingAdapter');
const { crearReserva, RESERVATION_STATUS } = require('../src/reservations/reservationModel');

const HORA = 3600e3;
const reservaEn = (offset, extra = {}) => ({
  ...crearReserva({ passengerId: 'p1', driverId: 'd1', driver: { name: 'Ana' }, route: { origin: 'A', dest: 'B', departureAt: new Date(Date.now() + offset).toISOString() } }),
  ...extra,
});

test('Iterator + Strategy: recorre solo las próximas, de la más cercana a la más lejana', () => {
  const lejana = reservaEn(10 * HORA);
  const cercana = reservaEn(2 * HORA);
  const pasada = reservaEn(-5 * HORA);
  const cancelada = reservaEn(5 * HORA, { status: RESERVATION_STATUS.CANCELLED });
  const coleccion = new ColeccionReservas([lejana, pasada, cancelada, cercana]);

  const it = coleccion.crearIterador(obtenerFiltro('proximas'));
  const recorridas = [];
  while (it.hasNext()) recorridas.push(it.next().id);

  assert.deepStrictEqual(recorridas, [cercana.id, lejana.id]);
  assert.throws(() => it.next(), /No hay más/);
  assert.strictEqual(coleccion.contar(obtenerFiltro('pasadas')), 1);
  assert.strictEqual(coleccion.contar(obtenerFiltro('canceladas')), 1);
  assert.strictEqual(coleccion.contar(obtenerFiltro('todas')), 4);
  assert.strictEqual(obtenerFiltro('inexistente'), null);
});

test('Adapter: traduce reservas del bookingModel del equipo al formato de MoveShare', () => {
  const bookings = [{
    id: 'b1', routeId: '7', driverId: 'u9', passengerId: 'p1', status: 'confirmada',
    routeSnapshot: { origin: 'Surco', dest: 'Ulima', time: '07:30', expiresAtTimestamp: Date.now() + HORA },
    createdAt: new Date().toISOString(),
  }];
  const bookingModelFalso = {
    getBookingsByPassenger: id => bookings.filter(b => b.passengerId === id),
    findBookingById: id => bookings.find(b => b.id === id) || null,
    getBookings: () => bookings,
    saveBookings: () => true,
  };
  const userModelFalso = { findUserById: () => ({ firstName: 'Luis', lastName: 'Rojas' }) };
  const adapter = new BookingAdapter(bookingModelFalso, userModelFalso);

  const [reserva] = adapter.listarPorPasajero('p1');
  assert.strictEqual(reserva.driver.name, 'Luis Rojas');
  assert.strictEqual(reserva.route.origin, 'Surco');
  assert.strictEqual(reserva.participation.status, 'pendiente');
  assert.ok(reserva.route.departureAt);

  const actualizada = adapter.actualizar('b1', { participation: { status: 'confirmada' } });
  assert.strictEqual(actualizada.participation.status, 'confirmada');
});

test('Command: confirmar, declinar y deshacer participación (US35)', () => {
  const dao = new ReservaDAO();
  dao.origen = 'moveshare';
  const service = new ReservaService({ repositorio: new ReservaRepositorio([dao]) });
  const reserva = dao.guardar(reservaEn(3 * HORA));

  let vista = service.confirmarParticipacion('p1', reserva.id);
  assert.strictEqual(vista.participacion.codigo, 'confirmada');
  assert.strictEqual(vista.acciones.puedeDeshacer, true);
  assert.throws(() => service.confirmarParticipacion('p1', reserva.id), /Ya confirmaste/);

  vista = service.declinarParticipacion('p1', reserva.id, 'Tengo examen');
  assert.strictEqual(vista.participacion.codigo, 'declinada');
  assert.strictEqual(vista.participacion.note, 'Tengo examen');

  // Deshacer dos veces vuelve al estado original (pendiente)
  assert.strictEqual(service.deshacerParticipacion('p1', reserva.id).reserva.participacion.codigo, 'confirmada');
  assert.strictEqual(service.deshacerParticipacion('p1', reserva.id).reserva.participacion.codigo, 'pendiente');
  assert.throws(() => service.deshacerParticipacion('p1', reserva.id), /No hay ninguna acción/);

  const pasada = dao.guardar(reservaEn(-HORA));
  assert.throws(() => service.confirmarParticipacion('p1', pasada.id), /ya salió/);
  assert.throws(() => service.confirmarParticipacion('otro', reserva.id), /no existe/);

  const listado = service.listar('p1', 'proximas');
  assert.strictEqual(listado.contadores.proximas, 1);
  assert.strictEqual(listado.contadores.pasadas, 1);
});
