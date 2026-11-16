const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { PasswordResetService, RESET_TTL_MS, REQUEST_MESSAGE } = require('../src/auth/passwordResetService');

function fixture() {
  let now = 1000000;
  let account = { id: 'test-user', email: 'rodrigo@example.test', password: 'old-hash', verified: true };
  const messages = [];
  const users = {
    findUserByEmail: email => email === account?.email ? account : null,
    findUserById: id => id === account?.id ? account : null,
    updateUser: (id, changes) => { account = { ...account, ...changes }; return account; },
  };
  const service = new PasswordResetService({ users, now: () => now, baseUrl: 'http://localhost:3000',
    sendEmail: async (to, url) => messages.push({ to, url }) });
  return { service, users, messages, advance: ms => { now += ms; }, account: () => account,
    removeUser: () => { account = null; },
    token: () => new URLSearchParams(new URL(messages.at(-1).url).hash.slice(1)).get('token') };
}

test('US20: solicitud normalizada y respuesta sin revelar el token', async () => {
  const f = fixture();
  assert.equal(await f.service.requestReset(' RODRIGO@example.test '), REQUEST_MESSAGE);
  assert.equal(f.messages[0].to, 'rodrigo@example.test');
  assert.equal(f.token().length, 64);
  assert.equal(f.service.pending.has(f.token()), false);
  assert.equal(f.account().password, 'old-hash');
});

test('US20: correo desconocido recibe el mismo mensaje, sin enviar correo', async () => {
  const f = fixture();
  assert.equal(await f.service.requestReset('nadie@example.test'), REQUEST_MESSAGE);
  assert.equal(f.messages.length, 0);
});

test('US20: rechaza formatos y tipos de correo inválidos', async () => {
  const f = fixture();
  for (const email of ['', 'sin-arroba', null, {}, 'a'.repeat(255) + '@a.test']) {
    await assert.rejects(f.service.requestReset(email), /correo electrónico válido/);
  }
});

test('US20: restablece el hash, conserva verificación e invalida sesiones anteriores', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  await f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123');
  assert.equal(await bcrypt.compare('NuevaClave123', f.account().password), true);
  assert.notEqual(f.account().password, 'NuevaClave123');
  assert.equal(f.account().verified, true);
  assert.equal(f.account().passwordVersion, 1);
});

test('US20: enlace de un solo uso', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  const token = f.token();
  await f.service.resetPassword(token, 'NuevaClave123', 'NuevaClave123');
  await assert.rejects(f.service.resetPassword(token, 'OtraClave123', 'OtraClave123'), /utilizado/);
});

test('US20: vence exactamente a los 15 minutos', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  f.advance(RESET_TTL_MS);
  await assert.rejects(f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123'), /venció/);
  assert.equal(f.account().password, 'old-hash');
});

test('US20: contraseña débil, demasiado larga o tipo incorrecto', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  for (const password of ['12345', '      ', 'a'.repeat(73), 'ñ'.repeat(37), null, {}]) {
    await assert.rejects(f.service.resetPassword(f.token(), password, password), /contraseña/);
  }
  assert.equal(f.account().password, 'old-hash');
  // El límite inferior válido sigue siendo el del registro existente.
  await f.service.resetPassword(f.token(), 'abc123', 'abc123');
});

test('US20: no consume el enlace cuando las contraseñas no coinciden', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  await assert.rejects(f.service.resetPassword(f.token(), 'NuevaClave123', 'Diferente123'), /coinciden/);
  await f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123');
});

test('US20: rechaza tokens mal formados y desconocidos', async () => {
  const f = fixture();
  for (const token of [undefined, '', {}, 'no-valido', 'a'.repeat(64)]) {
    await assert.rejects(f.service.resetPassword(token, 'NuevaClave123', 'NuevaClave123'));
  }
});

test('US20: limita reenvíos y el enlace nuevo reemplaza al anterior', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  const first = f.token();
  await f.service.requestReset('rodrigo@example.test');
  assert.equal(f.messages.length, 1);
  f.advance(60000);
  await f.service.requestReset('rodrigo@example.test');
  assert.equal(f.messages.length, 2);
  await assert.rejects(f.service.resetPassword(first, 'NuevaClave123', 'NuevaClave123'));
  await f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123');
});

test('US20: fallo de correo elimina el enlace y no modifica la contraseña', async t => {
  const f = fixture();
  t.mock.method(console, 'error', () => {});
  f.service.sendEmail = async () => { throw new Error('SMTP simulado'); };
  assert.equal(await f.service.requestReset('rodrigo@example.test'), REQUEST_MESSAGE);
  assert.equal(f.service.pending.size, 0);
  assert.equal(f.account().password, 'old-hash');
});

test('US20: fallo al guardar permite reintentar con el enlace', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  const original = f.users.updateUser;
  f.users.updateUser = () => { throw new Error('Disco lleno simulado'); };
  await assert.rejects(f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123'), /Disco lleno/);
  f.users.updateUser = original;
  await f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123');
});

test('US20: dos solicitudes simultáneas no consumen dos veces el enlace', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  const results = await Promise.allSettled([
    f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123'),
    f.service.resetPassword(f.token(), 'OtraClave123', 'OtraClave123'),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.account().passwordVersion, 1);
});

test('US20: cuenta eliminada y vencimiento durante hash no guardan cambios', async () => {
  const f = fixture();
  await f.service.requestReset('rodrigo@example.test');
  f.removeUser();
  await assert.rejects(f.service.resetPassword(f.token(), 'NuevaClave123', 'NuevaClave123'), /cuenta/);
  const g = fixture();
  await g.service.requestReset('rodrigo@example.test');
  const result = g.service.resetPassword(g.token(), 'NuevaClave123', 'NuevaClave123');
  g.advance(RESET_TTL_MS);
  await assert.rejects(result, /venció/);
});
