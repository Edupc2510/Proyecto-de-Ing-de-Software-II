// tests/cajaBlanca.guardarConductorFrecuente.test.js
// -------------------------------------------------------------
// PRUEBA DE CAJA BLANCA - US29 Guardar conductores frecuentes
// Metodo: saveFavoriteDriver(passengerId, driverId)
// Archivo: src/drivers/favoriteDriverService.js (lineas 67 a 90)
//
// Complejidad ciclomatica V(G) = 5
//   - Nodos predicado: !driverId, mismo usuario, conductor inexistente,
//     sin viaje terminado  -> P = 4 -> V(G) = P + 1 = 5
//   - Grafo de flujo: E = 15 aristas, N = 12 nodos -> 15 - 12 + 2 = 5
//
// Un caso por camino independiente (cobertura de caminos basicos):
//   CB-01  1-2-3-12                 sin conductor indicado     -> error 400
//   CB-02  1-2-4-5-12               se guarda a si mismo       -> error 400
//   CB-03  1-2-4-6-7-12             conductor inexistente      -> error 404
//   CB-04  1-2-4-6-8-9-12           sin viaje terminado        -> error 403
//   CB-05  1-2-4-6-8-10-11-12       viaje terminado            -> guardado (created: true)
// -------------------------------------------------------------
const { dir } = require('./helpers/tempDataDir');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { saveFavoriteDriver, FavoriteDriverError } = require('../src/drivers/favoriteDriverService');
const { getFavoritesByPassenger } = require('../src/drivers/favoriteDriverModel');

const HORA = 60 * 60 * 1000;

function escribir(archivo, datos) {
  fs.writeFileSync(path.join(dir, archivo), JSON.stringify(datos, null, 2));
}

function prepararDatos({ bookings = [] } = {}) {
  escribir('users.json', [
    { id: 'p1', firstName: 'Ana', lastName: 'Pasajera', role: 'pasajero' },
    { id: 'd1', firstName: 'Carlos', lastName: 'Conductor', role: 'conductor' },
    { id: 'd2', firstName: 'Lucia', lastName: 'Nueva', role: 'conductor' },
  ]);
  escribir('bookings.json', bookings);
  escribir('favoriteDrivers.json', []);
  escribir('ratings.json', []);
}

const viajeTerminado = {
  id: 'b1', routeId: 'r1', driverId: 'd1', passengerId: 'p1', status: 'confirmada',
  routeSnapshot: { origin: 'Surco', dest: 'ULima', time: '07:30', expiresAtTimestamp: Date.now() - 2 * HORA },
};

const esError = (status, texto) => (e) =>
  e instanceof FavoriteDriverError && e.status === status && texto.test(e.message);

describe('Caja blanca - saveFavoriteDriver (US29)', () => {
  beforeEach(() => prepararDatos({ bookings: [viajeTerminado] }));

  it('CB-01 - camino 1-2-3-12: sin conductor indicado -> 400', () => {
    assert.throws(() => saveFavoriteDriver('p1', ''), esError(400, /Debes indicar el conductor/));
    assert.strictEqual(getFavoritesByPassenger('p1').length, 0);
  });

  it('CB-02 - camino 1-2-4-5-12: el pasajero se guarda a si mismo -> 400', () => {
    assert.throws(() => saveFavoriteDriver('p1', 'p1'), esError(400, /a ti mismo/));
    assert.strictEqual(getFavoritesByPassenger('p1').length, 0);
  });

  it('CB-03 - camino 1-2-4-6-7-12: el conductor no existe -> 404', () => {
    assert.throws(() => saveFavoriteDriver('p1', 'd99'), esError(404, /no existe/));
    assert.strictEqual(getFavoritesByPassenger('p1').length, 0);
  });

  it('CB-04 - camino 1-2-4-6-8-9-12: nunca termino un viaje con ese conductor -> 403', () => {
    assert.throws(() => saveFavoriteDriver('p1', 'd2'), esError(403, /ya terminaste un viaje/));
    assert.strictEqual(getFavoritesByPassenger('p1').length, 0);
  });

  it('CB-05 - camino 1-2-4-6-8-10-11-12: viaje terminado -> se guarda', () => {
    const resultado = saveFavoriteDriver('p1', 'd1');
    assert.strictEqual(resultado.created, true);
    assert.strictEqual(resultado.driver.driverId, 'd1');
    assert.strictEqual(resultado.driver.name, 'Carlos Conductor');
    assert.strictEqual(getFavoritesByPassenger('p1').length, 1);
  });
});

