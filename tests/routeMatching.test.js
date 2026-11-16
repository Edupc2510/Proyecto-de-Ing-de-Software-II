// Pruebas unitarias y de caja blanca – US31 (coincidencia de ruta habitual)
// Módulo probado: src/notifications/routeMatchingService.js
// Ejecutar: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MATCH_RADIUS_KM,
  distanceKm,
  isTimeInRange,
  routeMatchesAlert,
} = require('../src/notifications/routeMatchingService');

const SURCO = [-12.1459, -76.9913];
const SAN_ISIDRO = [-12.0975, -77.0365];
const LA_MOLINA = [-12.0800, -76.9400];

const baseAlert = () => ({
  id: 'a1', userId: 'pas-1', active: true,
  originCoords: SURCO, destCoords: SAN_ISIDRO, timeFrom: null, timeTo: null,
});
const baseRoute = () => ({
  id: 1, driverId: 'drv-1', time: '08:00',
  originCoords: SURCO, destCoords: SAN_ISIDRO,
});

test('distanceKm: la distancia de un punto consigo mismo es 0', () => {
  assert.equal(distanceKm(SURCO, SURCO), 0);
});

test('distanceKm: Surco – San Isidro está entre 6 y 8 km (Haversine)', () => {
  const d = distanceKm(SURCO, SAN_ISIDRO);
  assert.ok(d > 6 && d < 8, `distancia obtenida ${d}`);
});

// ── Caja blanca: isTimeInRange tiene 4 caminos independientes ──
test('isTimeInRange C1: sin rango horario cualquier hora coincide', () => {
  assert.equal(isTimeInRange('18:00', null, null), true);
});

test('isTimeInRange C2: rango normal, hora dentro (incluye los límites)', () => {
  assert.equal(isTimeInRange('07:00', '07:00', '09:00'), true);
  assert.equal(isTimeInRange('09:00', '07:00', '09:00'), true);
});

test('isTimeInRange C3: rango normal, hora fuera (escenario 02 de US31)', () => {
  assert.equal(isTimeInRange('18:00', '07:00', '09:00'), false);
  assert.equal(isTimeInRange('06:59', '07:00', '09:00'), false);
});

test('isTimeInRange C4: rango que cruza la medianoche', () => {
  assert.equal(isTimeInRange('23:30', '22:00', '01:00'), true);
  assert.equal(isTimeInRange('00:30', '22:00', '01:00'), true);
  assert.equal(isTimeInRange('12:00', '22:00', '01:00'), false);
});

// ── Caja blanca: routeMatchesAlert, un caso por cada decisión ──
test('routeMatchesAlert D1: datos vacíos no coinciden', () => {
  assert.equal(routeMatchesAlert(null, baseAlert()), false);
  assert.equal(routeMatchesAlert(baseRoute(), null), false);
});

test('routeMatchesAlert D2: alerta pausada ("Recibir alertas" apagado, escenario 05)', () => {
  assert.equal(routeMatchesAlert(baseRoute(), { ...baseAlert(), active: false }), false);
});

test('routeMatchesAlert D3: el conductor no recibe alertas de su propia ruta', () => {
  assert.equal(routeMatchesAlert(baseRoute(), { ...baseAlert(), userId: 'drv-1' }), false);
});

test('routeMatchesAlert D4: coordenadas inválidas no coinciden', () => {
  assert.equal(routeMatchesAlert({ ...baseRoute(), originCoords: ['x', 1] }, baseAlert()), false);
  assert.equal(routeMatchesAlert(baseRoute(), { ...baseAlert(), destCoords: [1] }), false);
});

test('routeMatchesAlert D5: mismo origen y destino coincide (escenario 01)', () => {
  assert.equal(routeMatchesAlert(baseRoute(), baseAlert()), true);
});

test(`routeMatchesAlert D6: destino a más de ${MATCH_RADIUS_KM} km no coincide`, () => {
  assert.equal(routeMatchesAlert({ ...baseRoute(), destCoords: LA_MOLINA }, baseAlert()), false);
});

test('routeMatchesAlert D7: mismo trayecto pero fuera del horario no coincide (escenario 02)', () => {
  const morningAlert = { ...baseAlert(), timeFrom: '07:00', timeTo: '09:00' };
  assert.equal(routeMatchesAlert({ ...baseRoute(), time: '18:00' }, morningAlert), false);
  assert.equal(routeMatchesAlert({ ...baseRoute(), time: '08:30' }, morningAlert), true);
});
