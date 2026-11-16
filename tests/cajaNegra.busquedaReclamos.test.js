// tests/cajaNegra.busquedaReclamos.test.js
// ─────────────────────────────────────────────────────────────
// PRUEBA DE CAJA NEGRA - US37 Consultar estado del reclamo
// Funcionalidad: búsqueda de reclamos con 5 campos de entrada
//   1. código   2. estado   3. categoría   4. fecha desde   5. fecha hasta
// Interfaz probada: ReclamoFacade.consultarMisReclamos(passengerId, filtros)
// (la misma que usa GET /claims?codigo=&estado=&categoria=&desde=&hasta=)
// Técnicas: partición en clases de equivalencia + análisis de valores límite.
//
// Clases de equivalencia (V = válida, I = inválida)
//   Código:    CE1 vacío (V) · CE2 formato REC-AAAA-NNNNNN (V) · CE3 otro formato (I)
//   Estado:    CE4 vacío/"todos" (V) · CE5 valor del catálogo (V) · CE6 fuera del catálogo (I)
//   Categoría: CE7 vacío/"todas" (V) · CE8 valor del catálogo (V) · CE9 fuera del catálogo (I)
//   Desde:     CE10 vacío (V) · CE11 fecha real ≤ hoy (V) · CE12 formato incorrecto (I)
//              CE13 fecha inexistente (I) · CE14 fecha futura (I)
//   Hasta:     CE15 vacío (V) · CE16 fecha real (V) · CE17 fecha inválida (I)
//   Rango:     CE18 desde ≤ hasta (V) · CE19 desde > hasta (I)
// ─────────────────────────────────────────────────────────────
require('./helpers/tempDataDir');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

const { ReclamoFacade } = require('../src/claims/claimFacade');
const { ReclamoDAO } = require('../src/claims/claimDAO');
const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { BookingAdapter } = require('../src/reservations/bookingAdapter');
const { crearFakeBookingModel } = require('./helpers/fakeBookingModel');

const DIA = 24 * 3600e3;
const fecha = (offsetDias = 0) => {
  const d = new Date(Date.now() + offsetDias * DIA);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Caja negra · Búsqueda de reclamos con 5 campos (US37)', () => {
  const facade = new ReclamoFacade({ reservas: new ReservaRepositorio([new BookingAdapter(crearFakeBookingModel())]) });
  const dao = new ReclamoDAO();
  const R = {};
  const buscar = filtros => facade.consultarMisReclamos('pasajero-cn', filtros);
  const codigos = res => res.reclamos.map(r => r.codigo).sort();

  before(() => {
    const crear = (clave, category, status, offsetDias) => {
      const r = facade.registrarReclamo('pasajero-cn', { category, subject: `Reclamo ${clave}`, description: 'Detalle' });
      const creado = new Date(Date.now() + offsetDias * DIA).toISOString();
      dao.actualizar(r.id, { status, createdAt: creado, updatedAt: creado });
      R[clave] = r.code;
    };
    crear('A', 'cobro', 'en_proceso', -2);
    crear('B', 'seguridad', 'resuelto', -10);
    crear('C', 'objeto_perdido', 'registrado', 0);
    crear('D', 'ruta', 'rechazado', -4);
  });

  it('CN-01 · todos los campos vacíos (CE1, CE4, CE7, CE10, CE15) → devuelve los 4 reclamos', () => {
    const res = buscar({ codigo: '', estado: 'todos', categoria: 'todas', desde: '', hasta: '' });
    assert.strictEqual(res.encontrados, 4);
  });

  it('CN-02 · código válido en minúsculas (CE2) → se normaliza y encuentra 1 reclamo', () => {
    assert.deepStrictEqual(codigos(buscar({ codigo: R.A.toLowerCase() })), [R.A]);
  });

  it('CN-03 · código con formato incorrecto "REC-26-1" (CE3) → error en el campo Código', () => {
    assert.throws(() => buscar({ codigo: 'REC-26-1' }), /Código: debe tener el formato/);
  });

  it('CN-04 · código válido que no existe (CE2) → 0 resultados, sin error', () => {
    assert.strictEqual(buscar({ codigo: 'REC-1999-000001' }).encontrados, 0);
  });

  it('CN-05 · estado "en_proceso" + categoría "cobro" (CE5, CE8) → solo el reclamo A', () => {
    assert.deepStrictEqual(codigos(buscar({ estado: 'en_proceso', categoria: 'cobro' })), [R.A]);
  });

  it('CN-06 · estado fuera del catálogo "archivado" (CE6) → error en el campo Estado', () => {
    assert.throws(() => buscar({ estado: 'archivado' }), /Estado:/);
  });

  it('CN-07 · categoría fuera del catálogo "mascotas" (CE9) → error en el campo Categoría', () => {
    assert.throws(() => buscar({ categoria: 'mascotas' }), /Categoría:/);
  });

  it('CN-08 · rango desde = hoy-5 y hasta = hoy (CE11, CE16, CE18) → reclamos A, C y D', () => {
    assert.deepStrictEqual(codigos(buscar({ desde: fecha(-5), hasta: fecha(0) })), [R.A, R.C, R.D].sort());
  });

  it('CN-09 · valor límite: desde = hoy (CE11) → solo el reclamo de hoy (C)', () => {
    assert.deepStrictEqual(codigos(buscar({ desde: fecha(0) })), [R.C]);
  });

  it('CN-10 · valor límite: desde = mañana (CE14) → error de fecha futura', () => {
    assert.throws(() => buscar({ desde: fecha(1) }), /Fecha desde: no puede ser una fecha futura/);
  });

  it('CN-11 · fecha inexistente 2026-02-30 (CE13) → error de fecha no válida', () => {
    assert.throws(() => buscar({ desde: '2026-02-30' }), /Fecha desde: no es una fecha válida/);
  });

  it('CN-12 · fecha con formato dd/mm/aaaa (CE12) → error de fecha no válida', () => {
    assert.throws(() => buscar({ desde: '15/11/2026' }), /Fecha desde: no es una fecha válida/);
  });

  it('CN-13 · fecha hasta con mes 13 (CE17) → error en el campo Fecha hasta', () => {
    assert.throws(() => buscar({ hasta: '2026-13-01' }), /Fecha hasta: no es una fecha válida/);
  });

  it('CN-14 · desde posterior a hasta (CE19) → error de rango', () => {
    assert.throws(() => buscar({ desde: fecha(-1), hasta: fecha(-3) }), /Rango de fechas/);
  });

  it('CN-15 · valor límite: desde = hasta = hoy-4 (CE18) → solo el reclamo D', () => {
    assert.deepStrictEqual(codigos(buscar({ desde: fecha(-4), hasta: fecha(-4) })), [R.D]);
  });

  it('CN-16 · los 5 campos válidos combinados → exactamente el reclamo B', () => {
    const res = buscar({ codigo: R.B, estado: 'resuelto', categoria: 'seguridad', desde: fecha(-12), hasta: fecha(-8) });
    assert.deepStrictEqual(codigos(res), [R.B]);
  });
});
