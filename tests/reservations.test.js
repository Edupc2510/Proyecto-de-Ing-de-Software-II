// tests/reservations.test.js - US17 (Strategy + Iterator + Adapter) y US35 (Command)
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { ReservaService } = require('../src/reservations/reservationService');
const { ColeccionReservas } = require('../src/reservations/reservationCollection');
const { obtenerFiltro } = require('../src/reservations/reservationFilters');
const { BookingAdapter } = require('../src/reservations/bookingAdapter');
const { RESERVATION_STATUS } = require('../src/reservations/reservationModel');
const { crearFakeBookingModel, datosBooking } = require('./helpers/fakeBookingModel');

const HORA = 3600e3;
let n = 0;
const reservaEn = (offset, extra = {}) => ({
  id: `r${++n}`,
  passengerId: 'p1',
  route: { origin: 'A', dest: 'B', departureAt: new Date(Date.now() + offset).toISOString() },
  status: RESERVATION_STATUS.CONFIRMED,
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

test('Adapter: traduce los bookings de la US14 al formato de reservas', () => {
  const modelo = crearFakeBookingModel();
  const b = modelo.agregar(datosBooking({ driverId: 'u9', driverSnapshot: undefined }));
  modelo.agregar(datosBooking({ status: 'pendiente' })); // una solicitud pendiente no es reserva
  const userModelFalso = { findUserById: id => (id === 'u9' ? { firstName: 'Luis', lastName: 'Rojas' } : null) };
  const adapter = new BookingAdapter(modelo, userModelFalso);

  const reservas = adapter.listarPorPasajero('p1');
  assert.strictEqual(reservas.length, 1);
  assert.strictEqual(reservas[0].driver.name, 'Luis Rojas');
  assert.strictEqual(reservas[0].route.origin, 'A');
  assert.strictEqual(reservas[0].participation.status, 'pendiente');
  assert.ok(reservas[0].route.departureAt);

  const actualizada = adapter.actualizar(b.id, { participation: { status: 'confirmada' } });
  assert.strictEqual(actualizada.participation.status, 'confirmada');
  assert.strictEqual(modelo.findBookingById(b.id).participation.status, 'confirmada');
});

test('Command: confirmar, declinar y deshacer participación (US35)', () => {
  const modelo = crearFakeBookingModel();
  const service = new ReservaService({ repositorio: new ReservaRepositorio([new BookingAdapter(modelo)]) });
  const reserva = modelo.agregar(datosBooking({ offsetMs: 3 * HORA }));

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

  const pasada = modelo.agregar(datosBooking({ offsetMs: -HORA }));
  assert.throws(() => service.confirmarParticipacion('p1', pasada.id), /ya salió/);
  assert.throws(() => service.confirmarParticipacion('otro', reserva.id), /no existe/);

  const listado = service.listar('p1', 'proximas');
  assert.strictEqual(listado.contadores.proximas, 1);
  assert.strictEqual(listado.contadores.pasadas, 1);
});
