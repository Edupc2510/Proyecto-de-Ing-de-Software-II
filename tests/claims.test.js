// tests/claims.test.js - US37 (Facade + Decorator + Singleton)
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { GeneradorCodigoReclamo } = require('../src/claims/claimCodeGenerator');
const { ReclamoFacade } = require('../src/claims/claimFacade');
const { VistaReclamoBase, ConTiempoDeRespuesta, ConLineaDeTiempo } = require('../src/claims/claimViewDecorators');
const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { ReservaDAO } = require('../src/reservations/reservationDAO');

test('Singleton: el generador de códigos es único y correlativo', () => {
  const g = GeneradorCodigoReclamo.getInstancia();
  assert.strictEqual(g, GeneradorCodigoReclamo.getInstancia());
  assert.throws(() => new GeneradorCodigoReclamo({ codigosExistentes: () => [] }), /Singleton/);
  const a = g.siguienteCodigo(new Date(2030, 0, 15));
  const b = g.siguienteCodigo(new Date(2030, 4, 1));
  assert.strictEqual(a, 'REC-2030-000001');
  assert.strictEqual(b, 'REC-2030-000002');
});

test('Decorator: cada decorador agrega información sin modificar la vista base', () => {
  const reclamo = {
    id: 'r1', code: 'REC-2030-000009', subject: 'X', description: 'Y', category: 'seguridad', priority: 'alta',
    status: 'en_revision', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    history: [{ status: 'registrado', at: new Date().toISOString() }, { status: 'en_revision', at: new Date().toISOString() }],
  };
  const base = new VistaReclamoBase(reclamo).construir();
  assert.strictEqual(base.tiempoRespuesta, undefined);

  const decorada = new ConLineaDeTiempo(new ConTiempoDeRespuesta(new VistaReclamoBase(reclamo), reclamo), reclamo).construir();
  assert.strictEqual(decorada.codigo, base.codigo);
  assert.strictEqual(decorada.tiempoRespuesta.horasCompromiso, 24);
  assert.strictEqual(decorada.lineaDeTiempo.pasos.filter(p => p.completado).length, 2);
  assert.strictEqual(decorada.lineaDeTiempo.eventos.length, 2);
});

test('Facade: registra y consulta reclamos con una interfaz simple (US37)', () => {
  const facade = new ReclamoFacade({ reservas: new ReservaRepositorio([new ReservaDAO()]) });
  const reclamo = facade.registrarReclamo('p1', { category: 'cobro', subject: 'Cobro doble', description: 'Me cobraron dos veces' });
  facade.actualizarEstado(reclamo.id, 'resuelto', { nota: 'Se devolvió el dinero', agente: 'Andrea', respuesta: 'Devolución realizada' });

  const lista = facade.consultarMisReclamos('p1');
  assert.strictEqual(lista.total, 1);
  assert.strictEqual(lista.cerrados, 1);

  const detalle = facade.consultarReclamo('p1', reclamo.code.toLowerCase());
  assert.strictEqual(detalle.estado.etiqueta, 'Resuelto');
  assert.strictEqual(detalle.soporte.respuesta, 'Devolución realizada');
  assert.strictEqual(detalle.viaje, null);
  assert.throws(() => facade.consultarReclamo('otro', reclamo.code), /No encontramos/);
  assert.throws(() => facade.registrarReclamo('p1', { category: 'cobro', subject: '', description: '' }), /obligatorios/);
});
