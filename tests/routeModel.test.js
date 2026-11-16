// Pruebas unitarias – estados de una ruta (US34 cancelar, US14 ruta llena)
// Módulo probado: src/trips/routeModel.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { ROUTE_STATUS, isRouteCancelled, isRouteExpired, isRouteActive } = require('../src/trips/routeModel');

const NOW = Date.parse('2026-11-16T12:00:00Z');
const futura = (extra = {}) => ({ seats: 3, expiresAtTimestamp: NOW + 60000, status: ROUTE_STATUS.ACTIVE, ...extra });

test('ruta vigente con asientos está activa', () => {
  assert.equal(isRouteActive(futura(), NOW), true);
});

test('ruta antigua sin campo status se considera activa', () => {
  const { status, ...sinStatus } = futura();
  assert.equal(isRouteActive(sinStatus, NOW), true);
});

test('ruta cancelada no está activa (US34)', () => {
  const r = futura({ status: ROUTE_STATUS.CANCELLED });
  assert.equal(isRouteCancelled(r), true);
  assert.equal(isRouteActive(r, NOW), false);
});

test('ruta cuya hora ya pasó está vencida y no activa', () => {
  const r = futura({ expiresAtTimestamp: NOW - 1 });
  assert.equal(isRouteExpired(r, NOW), true);
  assert.equal(isRouteActive(r, NOW), false);
});

test('límite: vence exactamente en este instante', () => {
  assert.equal(isRouteExpired(futura({ expiresAtTimestamp: NOW }), NOW), true);
});

test('ruta llena (0 asientos) no aparece para pasajeros (US14 "Ruta llena")', () => {
  assert.equal(isRouteActive(futura({ seats: 0 }), NOW), false);
});

test('sin fecha de vencimiento no se considera vencida', () => {
  assert.equal(isRouteExpired({ seats: 2 }, NOW), false);
});
