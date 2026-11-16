const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

test('US22/26/36 integración: publicación, edición, filtros, reserva y reclamo', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'moveshare-trips-'));
  process.env.MOVESHARE_DATA_DIR = directory;
  const today = new Date(); today.setHours(1, 0, 0, 0);
  t.mock.method(Date, 'now', () => today.getTime());
  const password = await bcrypt.hash('Prueba123', 10);
  const users = ['driver', 'passenger', 'stranger'].map(id => ({ id, firstName: id, lastName: 'Prueba',
    email: `${id}@example.test`, verified: true, password }));
  fs.writeFileSync(path.join(directory, 'users.json'), JSON.stringify(users));
  let mailFails = false;
  const emails = [];
  t.mock.method(require('../src/auth/emailService'), 'sendReportConfirmationEmail', async (...args) => {
    if (mailFails) throw new Error('SMTP simulado caído');
    emails.push(args);
  });
  const app = require('../app');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, method = 'GET', body, cookie = '') => fetch(base + url, { method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  async function login(id) {
    const response = await request('/auth/login', 'POST', { email: `${id}@example.test`, password: 'Prueba123' });
    assert.equal(response.status, 200); return response.headers.get('set-cookie').split(';')[0];
  }
  const driver = await login('driver'), passenger = await login('passenger'), stranger = await login('stranger');
  const valid = { origin: 'Universidad', dest: 'Centro', time: '23:59', seats: 4,
    notes: 'Equipaje pequeño.', originCoords: [-12.08, -77.03], destCoords: [-12.04, -77.02] };

  await t.test('CN01–CN09 caja negra: formulario de 5 campos y coordenadas', async () => {
    // Cinco campos del formulario: origen, destino, hora, asientos y detalles.
    for (const change of [{ origin: '' }, { dest: '' }, { time: '25:00' }, { seats: 0 },
      { seats: 5 }, { notes: 'x'.repeat(501) }, { originCoords: null }, { destCoords: [91, 0] }]) {
      const response = await request('/trips', 'POST', { ...valid, ...change }, driver);
      assert.equal(response.status, 400, JSON.stringify(change));
    }
    assert.equal((await request('/trips', 'POST', valid)).status, 401);
  });
  const published = await request('/trips', 'POST', valid, driver);
  assert.equal(published.status, 201);
  const route = (await published.json()).route;
  assert.equal(route.initialSeats, 4);
  const editUrl = `/trips/${route.id}/details`;

  await t.test('US22: autoría, límites, persistencia y campos protegidos', async () => {
    assert.equal((await request(editUrl, 'PATCH', { notes: 'A' })).status, 401);
    assert.equal((await request(editUrl, 'PATCH', { notes: 'A' }, stranger)).status, 403);
    assert.equal((await request(editUrl, 'PATCH', { notes: '' }, driver)).status, 400);
    assert.equal((await request(editUrl, 'PATCH', { notes: 'x'.repeat(501) }, driver)).status, 400);
    const edited = await request(editUrl, 'PATCH', { notes: 'x'.repeat(500), seats: 99, driverId: 'stranger' }, driver);
    assert.equal(edited.status, 200);
    const saved = (await edited.json()).route;
    assert.equal(saved.notes.length, 500); assert.equal(saved.seats, 4); assert.equal(saved.driverId, 'driver');
    assert.equal((await request('/trips/missing/details', 'PATCH', { notes: 'A' }, driver)).status, 404);
  });
  await t.test('US22: rutas vencidas, canceladas o antiguas no permiten editar', async () => {
    const filename = path.join(directory, 'routes.json');
    const original = fs.readFileSync(filename, 'utf8');
    const stored = JSON.parse(original)[0];
    try {
      for (const change of [{ status: 'cancelada' }, { expiresAtTimestamp: Date.now() - 1 },
        { expiresAtTimestamp: undefined }, { initialSeats: undefined }]) {
        fs.writeFileSync(filename, JSON.stringify([{ ...stored, ...change }]));
        assert.equal((await request(editUrl, 'PATCH', { notes: 'Cambio' }, driver)).status, 409);
      }
    } finally { fs.writeFileSync(filename, original); }
  });
  await t.test('US26: filtrar no elimina rutas; limpiar restaura resultados', async () => {
    const before = fs.readFileSync(path.join(directory, 'routes.json'), 'utf8');
    assert.deepEqual(await (await request('/trips?timeTo=08:00')).json(), []);
    assert.equal((await (await request('/trips?timeFrom=23:59&minSeats=4')).json()).length, 1);
    assert.equal((await (await request('/trips')).json()).length, 1);
    assert.equal((await request('/trips?minSeats=0')).status, 400);
    assert.equal(fs.readFileSync(path.join(directory, 'routes.json'), 'utf8'), before);
  });
  await t.test('Vínculo: reservar registra al pasajero y bloquea editar detalles', async () => {
    assert.equal((await request('/trips/join', 'POST', { routeId: route.id })).status, 401);
    assert.equal((await request('/trips/join', 'POST', { routeId: route.id }, driver)).status, 403);
    assert.equal((await request('/trips/join', 'POST', { routeId: route.id }, passenger)).status, 200);
    assert.equal((await request('/trips/join', 'POST', { routeId: route.id }, passenger)).status, 409);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'bookings.json'))).length, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'routes.json')))[0].seats, 3);
    assert.equal((await request(editUrl, 'PATCH', { notes: 'Cambio' }, driver)).status, 409);
    const links = await (await request('/reports/trips', 'GET', undefined, passenger)).json();
    assert.equal(links.length, 1); assert.equal(links[0].routeId, String(route.id));
    assert.equal(links[0].role, 'passenger');
    assert.deepEqual(await (await request('/reports/trips', 'GET', undefined, stranger)).json(), []);
  });
  await t.test('US34 integrada: cancelar conserva el vínculo de ambos participantes', async () => {
    assert.equal((await request(`/trips/${route.id}`, 'DELETE', { confirmation: 'CANCELAR' }, stranger)).status, 403);
    assert.equal((await request(`/trips/${route.id}`, 'DELETE', { confirmation: 'CANCELAR' }, driver)).status, 200);
    const bookings = JSON.parse(fs.readFileSync(path.join(directory, 'bookings.json')));
    assert.equal(bookings[0].status, 'cancelada');
    assert.deepEqual(await (await request('/trips')).json(), []);
    for (const cookie of [driver, passenger]) {
      const links = await (await request('/reports/trips', 'GET', undefined, cookie)).json();
      assert.equal(links[0].routeId, String(route.id));
    }
  });
  await t.test('US36: acceso, guardado, confirmación, reintento y SMTP caído', async () => {
    const input = { routeId: String(route.id), category: 'ruta', description: 'Cambio de recorrido.', requestId: randomUUID() };
    assert.equal((await request('/reports', 'POST', input)).status, 401);
    assert.equal((await request('/reports', 'POST', input, stranger)).status, 403);
    const result = await request('/reports', 'POST', input, passenger);
    assert.equal(result.status, 201);
    const data = await result.json(); assert.equal(data.emailSent, true);
    const retry = await (await request('/reports', 'POST', input, passenger)).json();
    assert.equal(retry.code, data.code); assert.equal(emails.length, 1);
    mailFails = true;
    const driverReport = await (await request('/reports', 'POST', { ...input, requestId: randomUUID() }, driver)).json();
    assert.equal(driverReport.emailSent, false);
    const rows = JSON.parse(fs.readFileSync(path.join(directory, 'claims.json')));
    assert.equal(rows.length, 2); assert.equal(rows[1].code, driverReport.code);
    assert.equal(rows[1].reporterRole, 'driver');
  });
});
