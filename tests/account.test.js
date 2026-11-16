// tests/account.test.js - US19 (editar perfil) y US32 (gestión avanzada de cuenta)
// Facade + DAO + Adapter + reglas de validación. Los usuarios se simulan con un
// repositorio en memoria (DIP): las pruebas no tocan data/users.json.
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { AccountFacade, MENSAJE_SIN_CAMBIOS } = require('../src/account/accountFacade');
const { PerfilDAO, AjustesDAO } = require('../src/account/accountDAO');
const { ErrorValidacion } = require('../src/account/profileValidators');
const { UsuarioRepositorioAdapter } = require('../src/shared/users/userRepositoryAdapter');

function usuariosEnMemoria() {
  const lista = [
    { id: 'u1', firstName: 'Ana', lastName: 'Paredes', email: 'ana@ulima.edu.pe', dni: '12345678', createdAt: '2026-05-01T00:00:00Z' },
    { id: 'u2', firstName: 'Beto', lastName: 'Rojas', email: 'beto@ulima.edu.pe', dni: '87654321', createdAt: '2026-05-02T00:00:00Z' },
  ];
  return {
    lista,
    buscarPorId: id => lista.find(u => u.id === String(id)) || null,
    actualizar(id, cambios) { Object.assign(this.buscarPorId(id), cambios); return this.buscarPorId(id); },
  };
}
const crearCuenta = (usuarios = usuariosEnMemoria()) =>
  Object.assign(new AccountFacade({ usuarios, perfiles: new PerfilDAO(), ajustes: new AjustesDAO() }), { usuariosFalsos: usuarios });

function errorDe(fn) {
  try { fn(); } catch (e) { return e; }
  assert.fail('Se esperaba un ErrorValidacion');
}

test('US19 esc.01: edición exitosa guarda nombre, teléfono y preferencias', () => {
  const cuenta = crearCuenta();
  const r = cuenta.actualizarPerfil('u1', { firstName: ' María ', lastName: 'Paredes Díaz', phone: '987 654 321', preferencias: { musica: 'no' } });
  assert.strictEqual(r.actualizado, true);
  assert.strictEqual(r.perfil.firstName, 'María');           // se recorta el texto
  assert.strictEqual(r.perfil.phone, '987654321');
  assert.strictEqual(r.perfil.preferencias.musica, 'no');
  assert.strictEqual(r.perfil.preferencias.mascotas, 'indistinto'); // lo no enviado conserva su valor
  assert.strictEqual(cuenta.usuariosFalsos.buscarPorId('u1').firstName, 'María'); // nombre vive en users
  assert.strictEqual(new PerfilDAO().buscarPorId('u1').phone, '987654321');       // teléfono vive en el perfil
});

test('US19 esc.02: campos inválidos devuelven error por campo y no guardan nada', () => {
  const cuenta = crearCuenta();
  const e = errorDe(() => cuenta.actualizarPerfil('u2', { firstName: 'Be7o', phone: '12345' }));
  assert.ok(e instanceof ErrorValidacion);
  assert.strictEqual(e.errores.firstName.codigo, 'CAMPO_INVALIDO');
  assert.strictEqual(e.errores.phone.codigo, 'CAMPO_INVALIDO');
  assert.strictEqual(cuenta.obtenerPerfil('u2').firstName, 'Beto'); // sin cambios
});

test('US19 esc.03: campos obligatorios vacíos bloquean la actualización', () => {
  const cuenta = crearCuenta();
  const e = errorDe(() => cuenta.actualizarPerfil('u2', { firstName: '   ', lastName: '' }));
  assert.strictEqual(e.errores.firstName.codigo, 'CAMPO_VACIO');
  assert.strictEqual(e.errores.lastName.codigo, 'CAMPO_VACIO');
  assert.strictEqual(cuenta.obtenerPerfil('u2').lastName, 'Rojas');
});

test('US19 esc.04: sin cambios no se realiza ninguna actualización', () => {
  const cuenta = crearCuenta();
  const antes = JSON.stringify(new PerfilDAO().listar());
  const r = cuenta.actualizarPerfil('u2', { firstName: 'Beto', lastName: 'Rojas' });
  assert.strictEqual(r.actualizado, false);
  assert.strictEqual(r.mensaje, MENSAJE_SIN_CAMBIOS);
  assert.strictEqual(JSON.stringify(new PerfilDAO().listar()), antes);
});

test('US19: la foto de perfil acepta imágenes pequeñas y rechaza otros formatos; email y DNI no se editan', () => {
  const cuenta = crearCuenta();
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  assert.strictEqual(cuenta.actualizarPerfil('u1', { photo: pixel }).perfil.photo, pixel);
  assert.ok(errorDe(() => cuenta.actualizarPerfil('u1', { photo: 'data:text/html;base64,AAAA' })).errores.photo);
  assert.strictEqual(cuenta.actualizarPerfil('u1', { photo: null }).perfil.photo, null); // quitar foto
  const r = cuenta.actualizarPerfil('u1', { email: 'hack@x.com', dni: '00000000', firstName: 'Ana' });
  assert.strictEqual(r.perfil.email, 'ana@ulima.edu.pe');
  assert.strictEqual(r.perfil.dni, '12345678');
});

test('US32 esc.01: ocultar el teléfono lo quita del perfil público y deja solo el chat interno', () => {
  const cuenta = crearCuenta();
  cuenta.actualizarPerfil('u1', { phone: '987654321' });
  assert.strictEqual(cuenta.perfilPublico('u1').phone, '987654321'); // por defecto se muestra
  cuenta.actualizarAjustes('u1', { showPhone: false });
  const publico = cuenta.perfilPublico('u1');
  assert.strictEqual(publico.phone, null);
  assert.deepStrictEqual(publico.canalesContacto, ['chat_interno']);
});

test('US32 esc.02: desactivar notificaciones push deja de notificar coincidencias de ruta', () => {
  const cuenta = crearCuenta();
  assert.strictEqual(cuenta.puedeNotificar('u2', 'coincidenciaRuta'), true);
  cuenta.actualizarAjustes('u2', { pushNotifications: false });
  assert.strictEqual(cuenta.puedeNotificar('u2', 'coincidenciaRuta'), false);
});

test('US32 esc.03: el modo oscuro se guarda como preferencia de la cuenta', () => {
  const cuenta = crearCuenta();
  assert.strictEqual(cuenta.obtenerAjustes('u1').darkMode, false);
  assert.strictEqual(cuenta.actualizarAjustes('u1', { darkMode: true }).ajustes.darkMode, true);
  assert.strictEqual(cuenta.obtenerAjustes('u1').darkMode, true);
  assert.strictEqual(cuenta.obtenerAjustes('u2').darkMode, false); // no afecta a otros usuarios
});

test('US32 esc.04: pausar la cuenta oculta al usuario de las búsquedas y de las solicitudes hasta reactivarla', () => {
  const cuenta = crearCuenta();
  cuenta.actualizarAjustes('u2', { accountPaused: true });
  assert.strictEqual(cuenta.estaVisible('u2'), false);
  assert.strictEqual(cuenta.puedeRecibirSolicitudes('u2'), false);
  assert.strictEqual(cuenta.perfilPublico('u2'), null);
  cuenta.actualizarAjustes('u2', { accountPaused: false });
  assert.strictEqual(cuenta.estaVisible('u2'), true);
  assert.ok(cuenta.perfilPublico('u2'));
});

test('US32: rechaza ajustes desconocidos o con valores que no son booleanos y detecta "sin cambios"', () => {
  const cuenta = crearCuenta();
  assert.ok(errorDe(() => cuenta.actualizarAjustes('u1', { inventado: true })).errores.inventado);
  assert.ok(errorDe(() => cuenta.actualizarAjustes('u1', { darkMode: 'si' })).errores.darkMode);
  assert.strictEqual(cuenta.actualizarAjustes('u1', { darkMode: cuenta.obtenerAjustes('u1').darkMode }).actualizado, false);
});

test('Adapter: UsuarioRepositorioAdapter traduce las funciones de auth/userModel a la interfaz del repositorio', () => {
  const llamadas = [];
  const userModel = {
    findUserById: id => (id === 'a' ? { id: 'a' } : null),
    updateUser: (id, c) => { llamadas.push([id, c]); return { id, ...c }; },
    readUsers: () => [{ id: 'a' }],
  };
  const adapter = new UsuarioRepositorioAdapter(userModel);
  assert.strictEqual(adapter.existe('a'), true);
  assert.strictEqual(adapter.existe('zzz'), false);
  assert.strictEqual(adapter.buscarPorId(''), null);
  assert.deepStrictEqual(adapter.actualizar('a', { firstName: 'X' }), { id: 'a', firstName: 'X' });
  assert.deepStrictEqual(llamadas, [['a', { firstName: 'X' }]]);
  assert.strictEqual(adapter.listar().length, 1);
});
