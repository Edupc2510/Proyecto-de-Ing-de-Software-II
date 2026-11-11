// tests/routeSort.test.js
// Pruebas de US27 (ordenar por horario) y US28 (ordenar por asientos).
// Ejecutar con: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { sortRoutes, normalizeSortKey, SORT_KEYS } = require('../src/trips/routeSort');

const MIN = 60 * 1000;
const NOW = Date.now();

// Ruta de prueba: salida en `minutes` minutos desde ahora
const makeRoute = (id, minutes, seats, extra = {}) => ({
  id,
  seats,
  time: '00:00',
  expiresAtTimestamp: NOW + minutes * MIN,
  createdAt: new Date(NOW + id).toISOString(),
  ...extra,
});

const ids = (routes) => routes.map(r => r.id);

// ───────────── US27 ─────────────

test('US27 esc.01: "Más próximos" muestra primero la salida más cercana', () => {
  const routes = [makeRoute(1, 90, 3), makeRoute(2, 10, 3), makeRoute(3, 45, 3)];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.SOONEST)), [2, 3, 1]);
});

test('US27 esc.02: "Más tarde" invierte la lista', () => {
  const routes = [makeRoute(1, 90, 3), makeRoute(2, 10, 3), makeRoute(3, 45, 3)];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.LATEST)), [1, 3, 2]);
});

test('US27 esc.03: con la misma hora desempata por calificación del conductor', () => {
  const routes = [
    makeRoute(1, 30, 2, { driverRating: 3.5 }),
    makeRoute(2, 30, 2, { driverRating: 4.9 }),
    makeRoute(3, 30, 2, { driverRating: 4.1 }),
  ];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.SOONEST)), [2, 3, 1]);
});

test('US27 esc.03: si no hay calificaciones, desempata por más asientos', () => {
  const routes = [makeRoute(1, 30, 1), makeRoute(2, 30, 4)];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.SOONEST)), [2, 1]);
});

test('US27 esc.04: ordena solo el subconjunto recibido (filtros previos se respetan)', () => {
  const all = [makeRoute(1, 60, 3, { price: 8 }), makeRoute(2, 20, 3, { price: 15 }), makeRoute(3, 10, 3, { price: 9 })];
  const filtered = all.filter(r => r.price <= 10);
  assert.deepEqual(ids(sortRoutes(filtered, SORT_KEYS.SOONEST)), [3, 1]);
});

test('US27: no modifica el arreglo original', () => {
  const routes = [makeRoute(1, 90, 3), makeRoute(2, 10, 3)];
  sortRoutes(routes, SORT_KEYS.SOONEST);
  assert.deepEqual(ids(routes), [1, 2]);
});

test('US27: si falta expiresAtTimestamp usa el campo "time" (HH:mm)', () => {
  const late = { id: 1, seats: 2, time: '23:59' };
  const early = { id: 2, seats: 2, time: '00:01' };
  assert.deepEqual(ids(sortRoutes([late, early], SORT_KEYS.SOONEST)), [2, 1]);
});

// ───────────── US28 ─────────────

test('US28 esc.01: "Más asientos libres" pone arriba los de 3 o 4 cupos', () => {
  const routes = [makeRoute(1, 10, 1), makeRoute(2, 20, 4), makeRoute(3, 30, 3), makeRoute(4, 40, 2)];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.MOST_SEATS)), [2, 3, 4, 1]);
});

test('US28 esc.02: los viajes agotados quedan al final (con cualquier criterio)', () => {
  const routes = [makeRoute(1, 5, 0), makeRoute(2, 20, 2), makeRoute(3, 30, 4)];
  for (const key of Object.values(SORT_KEYS)) {
    const sorted = sortRoutes(routes, key);
    assert.equal(sorted[sorted.length - 1].id, 1, `falló con ${key}`);
  }
});

test('US28 esc.03: "Últimos cupos" prioriza los que tienen exactamente 1 asiento', () => {
  const routes = [makeRoute(1, 10, 4), makeRoute(2, 20, 1), makeRoute(3, 30, 2), makeRoute(4, 15, 1)];
  const sorted = ids(sortRoutes(routes, SORT_KEYS.LAST_SEATS));
  assert.deepEqual(sorted.slice(0, 2), [4, 2]);   // los de 1 asiento, el más próximo primero
  assert.deepEqual(sorted.slice(2), [3, 1]);      // luego 2 y 4 asientos
});

test('US28 esc.04: al reservar, la lista reordenada refleja el contador nuevo', () => {
  const routes = [makeRoute(1, 10, 4), makeRoute(2, 20, 3)];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.MOST_SEATS)), [1, 2]);
  routes[0].seats = 2; // otro pasajero reservó 2 cupos
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.MOST_SEATS)), [2, 1]);
});

test('US28 esc.05: con los mismos asientos desempata por horario más próximo', () => {
  const routes = [makeRoute(1, 60, 3), makeRoute(2, 15, 3), makeRoute(3, 30, 3)];
  assert.deepEqual(ids(sortRoutes(routes, SORT_KEYS.MOST_SEATS)), [2, 3, 1]);
});

// ───────────── Utilidades ─────────────

test('normalizeSortKey usa "soonest" si el criterio es inválido o falta', () => {
  assert.equal(normalizeSortKey(undefined), 'soonest');
  assert.equal(normalizeSortKey('cualquier-cosa'), 'soonest');
  assert.equal(normalizeSortKey('MOST-SEATS'), 'most-seats');
});

test('sortRoutes tolera entradas no válidas', () => {
  assert.deepEqual(sortRoutes(null, 'soonest'), []);
  assert.deepEqual(sortRoutes(undefined, 'latest'), []);
});
