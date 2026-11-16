const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseRouteFilters, filterRoutes } = require('../src/trips/routeFilters');
const routes = [{ id: 'a', time: '08:00', seats: 1 }, { id: 'b', time: '09:30', seats: 2 },
  { id: 'c', time: '11:00', seats: 4 }, { id: 'd', time: '12:00', seats: 2 }];
const ids = rows => rows.map(row => row.id);

test('US26: sin filtros conserva rutas, objetos y orden; no muta el origen', () => {
  const filtered = filterRoutes(routes, parseRouteFilters({ sort: 'most-seats' }));
  assert.deepEqual(filtered, routes);
  assert.notEqual(filtered, routes);
  assert.equal(filtered[0], routes[0]);
});
test('US26: intervalo incluye exactamente ambos extremos', () => {
  assert.deepEqual(ids(filterRoutes(routes, parseRouteFilters({ timeFrom: '09:30', timeTo: '11:00' }))), ['b', 'c']);
  assert.deepEqual(ids(filterRoutes(routes, parseRouteFilters({ timeFrom: '11:00', timeTo: '11:00' }))), ['c']);
});
test('US26: admite solo hora inicial o solo final', () => {
  assert.deepEqual(ids(filterRoutes(routes, parseRouteFilters({ timeFrom: '11:00' }))), ['c', 'd']);
  assert.deepEqual(ids(filterRoutes(routes, parseRouteFilters({ timeTo: '08:00' }))), ['a']);
});
test('US26: mínimo de asientos combinado con horario y sin coincidencias', () => {
  assert.deepEqual(ids(filterRoutes(routes, parseRouteFilters({ timeTo: '11:00', minSeats: '2' }))), ['b', 'c']);
  assert.deepEqual(filterRoutes(routes, parseRouteFilters({ timeTo: '08:00', minSeats: '4' })), []);
});
test('US26: rechaza horarios, intervalos y asientos inválidos, incluidos arrays', () => {
  for (const query of [{ timeFrom: '24:00' }, { timeTo: '09:60' }, { timeFrom: '9:00' },
    { timeFrom: [] }, { timeTo: {} }, { timeFrom: '10:00', timeTo: '09:00' },
    { minSeats: '0' }, { minSeats: '5' }, { minSeats: '1.5' }, { minSeats: ['2'] }, { minSeats: '2e0' }]) {
    assert.throws(() => parseRouteFilters(query));
  }
});
test('US26: hora ausente o inválida no satisface un filtro horario', () => {
  assert.deepEqual(filterRoutes([{ seats: 2 }, { time: '99:00', seats: 2 }], { timeFrom: '08:00' }), []);
});
