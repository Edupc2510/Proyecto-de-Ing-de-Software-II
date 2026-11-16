// Pruebas unitarias – patrón Strategy de criterios de coincidencia (US31)
// Módulos probados: src/notifications/matchCriteria.js y routeMatchesAlert

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CriterioCoincidencia,
  CriterioAlertaActiva,
  CriterioNoEsPropiaRuta,
  CriterioCoordenadasValidas,
  CriterioDistancia,
  CriterioHorario,
  CriterioPreferenciaCuenta,
  crearCriteriosBase,
} = require('../src/notifications/matchCriteria');
const { routeMatchesAlert } = require('../src/notifications/routeMatchingService');

const SURCO = [-12.1459, -76.9913];
const SAN_ISIDRO = [-12.0975, -77.0365];
const LA_MOLINA = [-12.0800, -76.9400];
const route = { id: 1, driverId: 'drv-1', time: '08:00', originCoords: SURCO, destCoords: SAN_ISIDRO };
const alert = { id: 'a1', userId: 'pas-1', active: true, originCoords: SURCO, destCoords: SAN_ISIDRO };

test('la estrategia base es abstracta', () => {
  assert.throws(() => new CriterioCoincidencia('x'), /abstracto/);
});

test('un criterio concreto sin cumple() avisa del error', () => {
  class CriterioIncompleto extends CriterioCoincidencia {}
  assert.throws(() => new CriterioIncompleto('incompleto').cumple(route, alert), /implementar cumple/);
});

test('crearCriteriosBase arma los 6 criterios de la US31 en orden', () => {
  const nombres = crearCriteriosBase().map(c => c.constructor.name);
  assert.deepEqual(nombres, [
    'CriterioAlertaActiva', 'CriterioNoEsPropiaRuta', 'CriterioCoordenadasValidas',
    'CriterioDistancia', 'CriterioDistancia', 'CriterioHorario',
  ]);
});

test('cada criterio decide por separado', () => {
  assert.equal(new CriterioAlertaActiva().cumple(route, { ...alert, active: false }), false);
  assert.equal(new CriterioNoEsPropiaRuta().cumple(route, { ...alert, userId: 'drv-1' }), false);
  assert.equal(new CriterioCoordenadasValidas().cumple({ ...route, destCoords: [1] }, alert), false);
  assert.equal(new CriterioDistancia('destCoords').cumple({ ...route, destCoords: LA_MOLINA }, alert), false);
  assert.equal(new CriterioDistancia('originCoords').cumple(route, alert), true);
  assert.equal(new CriterioHorario().cumple({ ...route, time: '18:00' }, { ...alert, timeFrom: '07:00', timeTo: '09:00' }), false);
});

test('el radio de distancia es configurable', () => {
  const lejos = { ...route, destCoords: LA_MOLINA };
  assert.equal(new CriterioDistancia('destCoords', 2).cumple(lejos, alert), false);
  assert.equal(new CriterioDistancia('destCoords', 20).cumple(lejos, alert), true);
});

test('preferencia de cuenta (US32) se inyecta como estrategia', () => {
  const apagado = new CriterioPreferenciaCuenta(() => false);
  const encendido = new CriterioPreferenciaCuenta(() => true);
  assert.equal(apagado.cumple(route, alert), false);
  assert.equal(encendido.cumple(route, alert), true);
});

test('routeMatchesAlert acepta otra lista de estrategias sin cambiar el servicio (OCP)', () => {
  // Nueva regla inventada: solo viajes que salen antes de las 09:00
  class CriterioAntesDeLasNueve extends CriterioCoincidencia {
    constructor() { super('antes de las 09:00'); }
    cumple(r) { return r.time < '09:00'; }
  }
  const criterios = [...crearCriteriosBase(), new CriterioAntesDeLasNueve()];
  assert.equal(routeMatchesAlert(route, alert, criterios), true);
  assert.equal(routeMatchesAlert({ ...route, time: '10:00' }, alert, criterios), false);
});

test('routeMatchesAlert con la preferencia de cuenta apagada no coincide', () => {
  const criterios = [...crearCriteriosBase(), new CriterioPreferenciaCuenta(() => false)];
  assert.equal(routeMatchesAlert(route, alert), true);
  assert.equal(routeMatchesAlert(route, alert, criterios), false);
});
