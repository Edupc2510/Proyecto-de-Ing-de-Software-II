// tests/requests.test.js - US15 (Factory Method + Adapter) y Singleton de persistencia
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { JsonDataSource } = require('../src/shared/persistence/JsonDataSource');
const { FabricaEstadoSolicitud, EstadoSolicitud } = require('../src/requests/requestStatusFactory');
const { BookingSolicitudAdapter } = require('../src/requests/bookingRequestAdapter');
const { SolicitudService } = require('../src/requests/requestService');
const { REQUEST_STATUS } = require('../src/requests/requestModel');
const { crearFakeBookingModel, datosBooking } = require('./helpers/fakeBookingModel');

const HORA = 3600e3;

test('Singleton: JsonDataSource siempre devuelve la misma instancia', () => {
  assert.strictEqual(JsonDataSource.getInstancia(), JsonDataSource.getInstancia());
  assert.throws(() => new JsonDataSource(), /Singleton/);
});

test('Factory Method: crea el estado concreto según el código', () => {
  const pendiente = FabricaEstadoSolicitud.crearEstado('pendiente');
  assert.ok(pendiente instanceof EstadoSolicitud);
  assert.strictEqual(pendiente.etiqueta, 'Pendiente');
  assert.strictEqual(pendiente.puedeCancelar(), true);
  assert.strictEqual(FabricaEstadoSolicitud.crearEstado('rechazada').puedeCancelar(), false);
  assert.strictEqual(FabricaEstadoSolicitud.crearEstado('desconocido').codigo, 'pendiente');
});

test('US15: muestra los bookings como solicitudes, calcula expiradas y permite cancelar pendientes', () => {
  const modelo = crearFakeBookingModel();
  const aceptada = modelo.agregar(datosBooking());
  const pendiente = modelo.agregar(datosBooking({ status: 'pendiente', offsetMs: 2 * HORA }));
  const vencida = modelo.agregar(datosBooking({ status: 'pendiente', offsetMs: -HORA }));
  modelo.agregar(datosBooking({ status: 'cancelada', cancelReason: 'Se malogró el auto' }));
  const ajena = modelo.agregar(datosBooking({ passengerId: 'otro' }));

  const service = new SolicitudService(new BookingSolicitudAdapter(modelo));
  const resultado = service.listar('p1');
  assert.strictEqual(resultado.total, 4);
  assert.deepStrictEqual(
    [resultado.resumen.aceptada, resultado.resumen.pendiente, resultado.resumen.expirada, resultado.resumen.cancelada],
    [1, 1, 1, 1]
  );
  assert.match(resultado.solicitudes.find(s => s.estado.codigo === 'cancelada').descripcion, /conductor canceló.*Se malogró/);
  // La expiración se calcula al mostrar: bookings.json no se modifica
  assert.strictEqual(modelo.findBookingById(vencida.id).status, 'pendiente');

  const cancelada = service.cancelar('p1', pendiente.id);
  assert.strictEqual(cancelada.estado.codigo, REQUEST_STATUS.CANCELLED);
  assert.strictEqual(cancelada.descripcion, 'Cancelaste esta solicitud.');
  assert.strictEqual(modelo.findBookingById(pendiente.id).status, 'cancelada');

  assert.throws(() => service.cancelar('p1', aceptada.id), /No puedes cancelar/);
  assert.throws(() => service.cancelar('p1', vencida.id), /No puedes cancelar/);
  assert.throws(() => service.detalle('p1', ajena.id), /no existe/);
  assert.strictEqual(service.detalle('p1', aceptada.id).historial.length, 2);
});
