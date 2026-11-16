const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ReportService, validateReportInput } = require('../src/reports/reportService');

const valid = () => ({ routeId: 'route-1', category: 'ruta', description: 'El viaje cambió de recorrido.', requestId: randomUUID() });
function fixture(role = 'passenger', sendEmail = async () => {}) {
  const rows = [];
  const reports = { findRequest: (id, requestId) => rows.find(row => row.passengerId === id && row.requestId === requestId),
    save: report => { const index = rows.findIndex(row => row.id === report.id); const copy = structuredClone(report);
      if (index < 0) rows.push(copy); else rows[index] = copy; } };
  const trips = { getForUser: id => id === 'u1' ? [{ routeId: 'route-1', role, reservationId: role === 'passenger' ? 'b1' : null,
    origin: 'Origen', dest: 'Destino', time: '12:00' }] : [] };
  const service = new ReportService({ reports, trips, sendEmail, now: () => new Date('2026-11-15T15:00:00Z') });
  return { rows, reports, trips, service, user: { id: 'u1', email: 'local@example.test' } };
}

const invalidCases = [
  ['CB01: viaje con tipo inválido', { routeId: 1 }],
  ['CB02: viaje vacío', { routeId: ' ' }],
  ['CB03: motivo con tipo inválido', { category: ['ruta'] }],
  ['CB04: motivo fuera del catálogo', { category: '__proto__' }],
  ['CB05: descripción con tipo inválido', { description: null }],
  ['CB06: descripción vacía', { description: ' ' }],
  ['CB07: descripción de 1001 caracteres', { description: 'x'.repeat(1001) }],
  ['CB08: identificador de envío ausente', { requestId: undefined }],
  ['CB09: identificador de envío incorrecto', { requestId: 'incorrecto' }],
];
for (const [name, override] of invalidCases) test(`US36 caja blanca ${name}`, () => {
  assert.throws(() => validateReportInput({ ...valid(), ...override }), { status: 400 });
});
test('US36 caja blanca CB10: camino válido y límites 1/1000 caracteres', () => {
  for (const length of [1, 1000]) {
    const input = { ...valid(), description: 'x'.repeat(length) };
    assert.deepEqual(validateReportInput(input), input);
  }
});
test('US36: pasajero vinculado obtiene código y correo; conserva contrato US37', async () => {
  const mails = [];
  const f = fixture('passenger', async (...args) => mails.push(args));
  const result = await f.service.register(f.user, valid());
  assert.match(result.code, /^REC-2026-[A-F0-9-]{36}$/);
  assert.equal(result.emailSent, true);
  assert.equal(f.rows[0].reservationId, 'b1');
  assert.equal(f.rows[0].status, 'registrado');
  assert.equal(f.rows[0].reporterRole, 'passenger');
  assert.equal(f.rows[0].passengerId, f.user.id);
  assert.deepEqual(mails, [[f.user.email, result.code]]);
});
test('US36: conductor vinculado también puede reportar', async () => {
  const f = fixture('driver');
  await f.service.register(f.user, valid());
  assert.equal(f.rows[0].reporterRole, 'driver');
  assert.equal(f.rows[0].reservationId, null);
});
test('US36: viaje ajeno no guarda ni envía', async () => {
  const f = fixture('passenger', async () => assert.fail('No debe enviar'));
  await assert.rejects(f.service.register({ id: 'otro' }, valid()), { status: 403 });
  assert.equal(f.rows.length, 0);
});
test('US36: SMTP fallido conserva reclamo y código', async () => {
  const f = fixture('passenger', async () => { throw new Error('SMTP'); });
  const result = await f.service.register(f.user, valid());
  assert.equal(result.emailSent, false);
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].code, result.code);
  assert.equal(f.rows[0].emailStatus, 'fallido');
});
test('US36: fallo al guardar no envía correo ni anuncia éxito', async () => {
  const f = fixture('passenger', async () => assert.fail('No debe enviar'));
  f.reports.save = () => { throw new Error('Sin espacio'); };
  await assert.rejects(f.service.register(f.user, valid()), /Sin espacio/);
});
test('US36: reintento o doble clic no duplica reclamo ni correo', async () => {
  let sent = 0;
  const f = fixture('passenger', async () => { sent++; });
  const input = valid();
  const [first, second] = await Promise.all([f.service.register(f.user, input), f.service.register(f.user, input)]);
  assert.equal(first.code, second.code);
  assert.equal(f.rows.length, 1);
  assert.equal(sent, 1);
});
test('US36: falla actualizar estado del correo, pero persiste el primer guardado', async () => {
  const f = fixture();
  const save = f.reports.save;
  let count = 0;
  f.reports.save = report => {
    count++;
    if (count === 2) throw new Error('Disco ocupado');
    save(report);
  };
  const result = await f.service.register(f.user, valid());
  assert.equal(result.emailSent, false);
  assert.equal(f.rows.length, 1);
  assert.equal(f.rows[0].code, result.code);
  assert.equal(f.rows[0].emailStatus, 'pendiente');
});
