// PRUEBA DE CAJA NEGRA (US19) · editar perfil con 5 campos: firstName, lastName, phone, photo, preferencias.
// Interfaz: PUT /account/profile -> AccountFacade.actualizarPerfil(userId, datos). Clases de equivalencia + valores límite.
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');
const { AccountFacade } = require('../src/account/accountFacade');
const { PerfilDAO, AjustesDAO } = require('../src/account/accountDAO');
const { ErrorValidacion } = require('../src/account/profileValidators');

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function crearCuenta(previo = null) {
  new PerfilDAO().eliminarDonde(() => true); // aislamiento: cada caso parte sin perfil guardado
  const lista = [{ id: 'u1', firstName: 'Ana', lastName: 'Paredes', email: 'ana@ulima.edu.pe', dni: '12345678', createdAt: '2026-05-01T00:00:00Z' }];
  const usuarios = { buscarPorId: id => lista.find(u => u.id === String(id)) || null, actualizar(id, c) { Object.assign(this.buscarPorId(id), c); return this.buscarPorId(id); } };
  const cuenta = new AccountFacade({ usuarios, perfiles: new PerfilDAO(), ajustes: new AjustesDAO() });
  if (previo) cuenta.actualizarPerfil('u1', previo);
  return cuenta;
}
const PRECONDICION = { 'CN-06': { phone: '987654321' }, 'CN-07': { photo: PIXEL } };

const VALIDOS = [
  ['CN-01', 'Los 5 campos válidos', { firstName: 'María', lastName: 'Díaz', phone: '987654321', photo: PIXEL, preferencias: { musica: 'no' } }, p => p.firstName === 'María' && p.phone === '987654321' && p.photo === PIXEL && p.preferencias.musica === 'no'],
  ['CN-02', 'Límite: nombre de 2 letras', { firstName: 'Al' }, p => p.firstName === 'Al'],
  ['CN-03', 'Límite: nombre de 40 letras', { firstName: 'A'.repeat(40) }, p => p.firstName.length === 40],
  ['CN-04', 'Apellido con guion y apóstrofo', { lastName: "O'Higgins-Díaz" }, p => p.lastName === "O'Higgins-Díaz"],
  ['CN-05', 'Teléfono con +51, espacios y guiones', { phone: '+51 987-654-321' }, p => p.phone === '987654321'],
  ['CN-06', 'Teléfono vacío (opcional)', { phone: '' }, p => p.phone === ''],
  ['CN-07', 'Foto: quitar con null', { photo: null }, p => p.photo === null],
  ['CN-08', 'Preferencia del catálogo', { preferencias: { mascotas: 'si' } }, p => p.preferencias.mascotas === 'si' && p.preferencias.musica === 'indistinto'],
];
const INVALIDOS = [
  ['CN-09', 'Nombre de 1 letra (bajo el límite)', { firstName: 'A' }, 'firstName', 'CAMPO_INVALIDO'],
  ['CN-10', 'Nombre de 41 letras (sobre el límite)', { firstName: 'A'.repeat(41) }, 'firstName', 'CAMPO_INVALIDO'],
  ['CN-11', 'Nombre con dígitos ("Be7o")', { firstName: 'Be7o' }, 'firstName', 'CAMPO_INVALIDO'],
  ['CN-12', 'Nombre solo con espacios', { firstName: '   ' }, 'firstName', 'CAMPO_VACIO'],
  ['CN-13', 'Apellido vacío', { lastName: '' }, 'lastName', 'CAMPO_VACIO'],
  ['CN-14', 'Teléfono que empieza con 8', { phone: '887654321' }, 'phone', 'CAMPO_INVALIDO'],
  ['CN-15', 'Teléfono de 8 dígitos', { phone: '98765432' }, 'phone', 'CAMPO_INVALIDO'],
  ['CN-16', 'Teléfono de 10 dígitos', { phone: '9876543210' }, 'phone', 'CAMPO_INVALIDO'],
  ['CN-17', 'Foto con formato no permitido', { photo: 'data:text/html;base64,AAAA' }, 'photo', 'CAMPO_INVALIDO'],
  ['CN-18', 'Foto demasiado pesada (>90 000)', { photo: 'data:image/png;base64,' + 'A'.repeat(90000) }, 'photo', 'CAMPO_INVALIDO'],
  ['CN-19', 'Preferencia fuera del catálogo', { preferencias: { musica: 'rock' } }, 'preferencias', 'CAMPO_INVALIDO'],
  ['CN-20', 'Preferencia desconocida', { preferencias: { idioma: 'si' } }, 'preferencias', 'CAMPO_INVALIDO'],
  ['CN-21', 'Preferencias que no son un objeto', { preferencias: 'si' }, 'preferencias', 'CAMPO_INVALIDO'],
];
for (const [id, d, entrada, ok] of VALIDOS) test(`${id} · ${d} -> se actualiza`, () => {
  const r = crearCuenta(PRECONDICION[id]).actualizarPerfil('u1', entrada);
  assert.strictEqual(r.actualizado, true); assert.ok(ok(r.perfil));
});
for (const [id, d, entrada, campo, codigo] of INVALIDOS) test(`${id} · ${d} -> error ${codigo} en "${campo}"`, () => {
  const cuenta = crearCuenta(); const antes = JSON.stringify(cuenta.obtenerPerfil('u1')); let error;
  try { cuenta.actualizarPerfil('u1', entrada); } catch (e) { error = e; }
  assert.ok(error instanceof ErrorValidacion); assert.strictEqual(error.status, 422);
  assert.strictEqual(error.errores[campo].codigo, codigo); assert.strictEqual(JSON.stringify(cuenta.obtenerPerfil('u1')), antes);
});
test('CN-22 · varios campos inválidos -> un error por campo y no guarda nada', () => {
  const cuenta = crearCuenta(); const antes = JSON.stringify(cuenta.obtenerPerfil('u1')); let error;
  try { cuenta.actualizarPerfil('u1', { firstName: '', phone: '123', preferencias: { musica: 'rock' } }); } catch (e) { error = e; }
  assert.deepStrictEqual(Object.keys(error.errores).sort(), ['firstName', 'phone', 'preferencias']);
  assert.strictEqual(JSON.stringify(cuenta.obtenerPerfil('u1')), antes);
});
test('CN-23 · mismos datos ya guardados -> "sin cambios"', () => {
  const r = crearCuenta().actualizarPerfil('u1', { firstName: 'Ana', lastName: 'Paredes' });
  assert.strictEqual(r.actualizado, false); assert.strictEqual(r.mensaje, 'No hay cambios para guardar.');
});
test('CN-24 · intentar cambiar email y DNI -> se ignoran', () => {
  const r = crearCuenta().actualizarPerfil('u1', { email: 'otro@x.com', dni: '00000000', firstName: 'Anita' });
  assert.strictEqual(r.perfil.email, 'ana@ulima.edu.pe'); assert.strictEqual(r.perfil.dni, '12345678'); assert.strictEqual(r.perfil.firstName, 'Anita');
});
test('CN-25 · usuario inexistente -> 404', () => {
  let error; try { crearCuenta().actualizarPerfil('fantasma', { firstName: 'Ana' }); } catch (e) { error = e; }
  assert.strictEqual(error.status, 404);
});
