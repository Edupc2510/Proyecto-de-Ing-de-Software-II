// tests/requests.test.js - US15 (Factory Method + DAO) y Singleton de persistencia
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { JsonDataSource } = require('../src/shared/persistence/JsonDataSource');
const { FabricaEstadoSolicitud, EstadoSolicitud } = require('../src/requests/requestStatusFactory');
const { SolicitudDAO } = require('../src/requests/requestDAO');
const { SolicitudService } = require('../src/requests/requestService');
const { crearSolicitud, REQUEST_STATUS } = require('../src/requests/requestModel');

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

test('US15: lista solicitudes del pasajero, expira pendientes vencidas y permite cancelar', () => {
  const dao = new SolicitudDAO();
  const service = new SolicitudService(dao);
  const futura = crearSolicitud({ passengerId: 'p1', driver: { name: 'Ana' }, route: { origin: 'A', dest: 'B', departureAt: new Date(Date.now() + 3600e3).toISOString() } });
  const vencida = crearSolicitud({ passengerId: 'p1', driver: { name: 'Beto' }, route: { origin: 'C', dest: 'D', departureAt: new Date(Date.now() - 3600e3).toISOString() } });
  const ajena = crearSolicitud({ passengerId: 'otro', driver: { name: 'X' }, route: {} });
  [futura, vencida, ajena].forEach(s => dao.guardar(s));

  const resultado = service.listar('p1');
  assert.strictEqual(resultado.total, 2);
  assert.strictEqual(resultado.resumen.expirada, 1);
  assert.strictEqual(resultado.resumen.pendiente, 1);

  const cancelada = service.cancelar('p1', futura.id);
  assert.strictEqual(cancelada.estado.codigo, REQUEST_STATUS.CANCELLED);
  assert.throws(() => service.cancelar('p1', futura.id), /No puedes cancelar/);
  assert.throws(() => service.detalle('p1', ajena.id), /no existe/);
});
