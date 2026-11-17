// PRUEBA UNITARIA (US32) · AccountFacade.actualizarAjustes(userId, cambios) · accountFacade.js L112-129
// Dependencias reemplazadas por dobles en memoria.
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');
const { AccountFacade, MENSAJE_SIN_CAMBIOS } = require('../src/account/accountFacade');
const { ErrorValidacion } = require('../src/account/profileValidators');
const { DomainError } = require('../src/shared/httpHelpers');

function crear(iniciales = {}) {
  const escrituras = []; const guardados = { u1: { id: 'u1', ...iniciales } };
  const ajustes = { buscarPorId: id => guardados[String(id)] || null,
    guardarOActualizar: (id, c) => { escrituras.push({ id, cambios: c }); guardados[id] = { ...(guardados[id] || { id }), ...c }; return guardados[id]; } };
  const usuarios = { buscarPorId: id => (id === 'u1' ? { id: 'u1', firstName: 'Ana', lastName: 'Paredes' } : null) };
  return { cuenta: new AccountFacade({ usuarios, perfiles: { buscarPorId: () => null }, ajustes }), escrituras };
}
const fallo = fn => { try { fn(); } catch (e) { return e; } assert.fail('Se esperaba un error'); };

test('UT-01 · cambio válido (modo oscuro) -> actualizado y guarda solo ese ajuste', () => {
  const { cuenta, escrituras } = crear(); const r = cuenta.actualizarAjustes('u1', { darkMode: true });
  assert.strictEqual(r.actualizado, true); assert.strictEqual(r.mensaje, 'Preferencias actualizadas.'); assert.strictEqual(r.ajustes.darkMode, true);
  assert.deepStrictEqual(escrituras.map(e => e.cambios), [{ darkMode: true }]);
});
test('UT-02 · mismo valor que ya tiene -> "sin cambios" y no escribe', () => {
  const { cuenta, escrituras } = crear({ pushNotifications: true }); const r = cuenta.actualizarAjustes('u1', { pushNotifications: true });
  assert.strictEqual(r.actualizado, false); assert.strictEqual(r.mensaje, MENSAJE_SIN_CAMBIOS); assert.strictEqual(escrituras.length, 0);
});
test('UT-03 · ajuste desconocido -> ErrorValidacion AJUSTE_DESCONOCIDO', () => {
  const { cuenta, escrituras } = crear(); const e = fallo(() => cuenta.actualizarAjustes('u1', { volarSolo: true }));
  assert.ok(e instanceof ErrorValidacion); assert.strictEqual(e.errores.volarSolo.codigo, 'AJUSTE_DESCONOCIDO'); assert.strictEqual(escrituras.length, 0);
});
test('UT-04 · valor no booleano -> ErrorValidacion CAMPO_INVALIDO', () => {
  const { cuenta, escrituras } = crear(); const e = fallo(() => cuenta.actualizarAjustes('u1', { showPhone: 'false' }));
  assert.strictEqual(e.errores.showPhone.codigo, 'CAMPO_INVALIDO'); assert.strictEqual(escrituras.length, 0);
});
test('UT-05 · varios ajustes -> solo se guardan los que cambiaron', () => {
  const { cuenta, escrituras } = crear(); const r = cuenta.actualizarAjustes('u1', { showPhone: false, pushNotifications: true });
  assert.strictEqual(r.actualizado, true); assert.deepStrictEqual(escrituras.map(e => e.cambios), [{ showPhone: false }]);
});
test('UT-06 · pausar la cuenta -> estaVisible y puedeRecibirSolicitudes pasan a false', () => {
  const { cuenta } = crear(); assert.strictEqual(cuenta.estaVisible('u1'), true);
  cuenta.actualizarAjustes('u1', { accountPaused: true });
  assert.strictEqual(cuenta.estaVisible('u1'), false); assert.strictEqual(cuenta.puedeRecibirSolicitudes('u1'), false);
});
test('UT-07 · usuario inexistente -> DomainError 404', () => {
  const { cuenta } = crear(); const e = fallo(() => cuenta.actualizarAjustes('fantasma', { darkMode: true }));
  assert.ok(e instanceof DomainError); assert.strictEqual(e.status, 404);
});
