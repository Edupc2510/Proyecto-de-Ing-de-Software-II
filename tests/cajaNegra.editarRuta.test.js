// tests/cajaNegra.editarRuta.test.js
// -------------------------------------------------------------
// PRUEBA DE CAJA NEGRA - US33 Editar ruta publicada
// Funcionalidad: applyRouteEdit({ route, userId, changes })  (PUT /trips/:routeId)
// Archivo: src/trips/routeEditService.js
//
// 5 campos de entrada: hora de salida, capacidad total, detalles de la ruta,
// origen (con coordenadas) y destino (con coordenadas).
// Tecnicas: clases de equivalencia y valores limite.
//
// Datos: ruta del conductor d1, Surco -> ULima, sale a las 18:00, 3 asientos
// libres y 1 reservado (capacidad total 4). "Ahora" = 10:00 del mismo dia.
// -------------------------------------------------------------
const { dir } = require('./helpers/tempDataDir');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { applyRouteEdit, RouteEditError, LOCK_MESSAGE } = require('../src/trips/routeEditService');

const AHORA = new Date(2026, 10, 20, 10, 0, 0).getTime();
const SALIDA = new Date(2026, 10, 20, 18, 0, 0).getTime();
const SURCO = [-12.1366, -76.9912];
const ULIMA = [-12.0846, -76.9711];
const MIRAFLORES = [-12.1211, -77.0297];

function rutaBase(extra = {}) {
  return {
    id: 'r1', driverId: 'd1', origin: 'Surco', dest: 'ULima',
    originCoords: SURCO, destCoords: ULIMA,
    time: '18:00', expiresAtTimestamp: SALIDA, seats: 3, notes: 'Por Av. Primavera',
    status: 'activa', ...extra,
  };
}

function editar(changes, route = rutaBase(), now = AHORA) {
  return applyRouteEdit({ route, userId: 'd1', changes, now });
}

const esError = (texto) => (e) => e instanceof RouteEditError && e.status === 400 && texto.test(e.message);

describe('Caja negra - editar ruta publicada con 5 campos (US33)', () => {
  beforeEach(() => {
    fs.writeFileSync(path.join(dir, 'bookings.json'), JSON.stringify([
      { id: 'b1', routeId: 'r1', driverId: 'd1', passengerId: 'p1', status: 'confirmada' },
    ]));
  });

  it('CN-01 - hora valida y futura (17:30) -> se guarda', () => {
    const r = editar({ time: '17:30' });
    assert.deepStrictEqual(r.changedFields, ['time']);
    assert.strictEqual(r.updatedRoute.time, '17:30');
  });

  it('CN-02 - hora con formato invalido (7:5) -> error de formato', () => {
    assert.throws(() => editar({ time: '7:5' }), esError(/formato HH:mm/));
  });

  it('CN-03 - hora fuera de rango (24:00) -> error de formato', () => {
    assert.throws(() => editar({ time: '24:00' }), esError(/formato HH:mm/));
  });

  it('CN-04 - hora ya pasada (09:00 con "ahora" 10:00) -> error de hora vencida', () => {
    assert.throws(() => editar({ time: '09:00' }), esError(/no puede estar vencida/));
  });

  it('CN-05 - capacidad en el limite inferior permitido (1 = asientos reservados) -> 0 libres', () => {
    const r = editar({ totalSeats: 1 });
    assert.strictEqual(r.updatedRoute.totalSeats, 1);
    assert.strictEqual(r.updatedRoute.seats, 0);
  });

  it('CN-06 - capacidad 2 con 1 reservado (escenario 04) -> queda 1 libre', () => {
    const r = editar({ totalSeats: 2 });
    assert.strictEqual(r.updatedRoute.seats, 1);
  });

  it('CN-07 - capacidad en el limite superior (4) igual a la actual -> sin cambios', () => {
    assert.throws(() => editar({ totalSeats: 4 }), esError(/No hiciste ning/));
  });

  it('CN-08 - capacidad fuera de rango (5) -> error de rango', () => {
    assert.throws(() => editar({ totalSeats: 5 }), esError(/entre 1 y 4/));
  });

  it('CN-09 - capacidad 0 o decimal (2.5) -> error de rango', () => {
    assert.throws(() => editar({ totalSeats: 0 }), esError(/entre 1 y 4/));
    assert.throws(() => editar({ totalSeats: 2.5 }), esError(/entre 1 y 4/));
  });

  it('CN-10 - capacidad menor a los asientos reservados (2 reservas, capacidad 1) -> error', () => {
    fs.writeFileSync(path.join(dir, 'bookings.json'), JSON.stringify([
      { id: 'b1', routeId: 'r1', passengerId: 'p1', status: 'confirmada' },
      { id: 'b2', routeId: 'r1', passengerId: 'p2', status: 'confirmada' },
    ]));
    assert.throws(() => editar({ totalSeats: 1 }, rutaBase({ seats: 2 })), esError(/por debajo de los 2/));
  });

  it('CN-11 - detalles validos (cambio de avenida, escenario 03) -> se guardan', () => {
    const r = editar({ notes: 'Por Av. Javier Prado' });
    assert.deepStrictEqual(r.changedFields, ['notes']);
  });

  it('CN-12 - detalles vacios o de 501 caracteres -> error', () => {
    assert.throws(() => editar({ notes: '   ' }), esError(/Escribe los detalles/));
    assert.throws(() => editar({ notes: 'a'.repeat(501) }), esError(/hasta 500/));
  });

  it('CN-13 - origen valido con coordenadas -> se guarda', () => {
    const r = editar({ origin: 'Miraflores', originCoords: MIRAFLORES });
    assert.deepStrictEqual(r.changedFields, ['origin']);
    assert.deepStrictEqual(r.updatedRoute.originCoords, MIRAFLORES);
  });

  it('CN-14 - origen sin coordenadas o vacio -> error', () => {
    assert.throws(() => editar({ origin: 'Miraflores' }), esError(/sugerencias de direcci/));
    assert.throws(() => editar({ origin: '  ', originCoords: MIRAFLORES }), esError(/origen es obligatorio/));
  });

  it('CN-15 - destino igual al origen -> error', () => {
    assert.throws(() => editar({ dest: 'Surco', destCoords: SURCO }), esError(/no pueden ser iguales/));
  });

  it('CN-16 - los 5 campos validos a la vez -> 5 campos cambiados', () => {
    const r = editar({
      time: '17:00', totalSeats: 3, notes: 'Por la Via Expresa',
      origin: 'Miraflores', originCoords: MIRAFLORES,
      dest: 'Universidad de Lima', destCoords: ULIMA,
    });
    assert.deepStrictEqual(r.changedFields, ['time', 'totalSeats', 'notes', 'origin', 'dest']);
    assert.strictEqual(r.updatedRoute.seats, 2);
  });

  it('CN-17 - faltan menos de 30 minutos para salir (escenario 02) -> bloqueado 409', () => {
    const casiSale = new Date(2026, 10, 20, 17, 40, 0).getTime();
    assert.throws(
      () => editar({ notes: 'Cambio de ultimo minuto' }, rutaBase(), casiSale),
      (e) => e instanceof RouteEditError && e.status === 409 && e.message === LOCK_MESSAGE
    );
  });
});
