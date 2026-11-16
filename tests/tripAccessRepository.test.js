const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TripAccessRepository } = require('../src/trips/tripAccessRepository');
const { ReportRepository } = require('../src/reports/reportRepository');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'moveshare-adapter-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const write = (file, rows) => fs.writeFileSync(path.join(directory, file), JSON.stringify(rows));
  return { directory, write, access: new TripAccessRepository(directory) };
}
test('US36 adaptador: bookings es la fuente de reservas; ignora almacenes alternativos', t => {
  const { write, access } = fixture(t);
  write('routes.json', [{ id: 1, driverId: 'd', origin: 'O', dest: 'D', time: '12:00' }]);
  write('bookings.json', [{ id: 'b1', routeId: '1', driverId: 'd', passengerId: 'p', status: 'confirmada', routeSnapshot: { origin: 'O', dest: 'D', time: '12:00' } }]);
  write('reservations.json', [{ id: 'r1', routeId: '1', driverId: 'd', passengerId: 'p', route: { origin: 'O', dest: 'D', time: '12:00' } },
    { id: 'demo', routeId: 'fake', passengerId: 'p', demo: true }]);
  write('tripHistory.json', [{ routeId: '2', driverId: 'd', passengerId: 'p', origin: 'X', dest: 'Y', time: '08:00', cancelled: true }]);
  const passenger = access.getForUser('p');
  assert.equal(passenger.length, 1);
  assert.equal(passenger[0].reservationId, 'b1');
  assert.equal(access.getForUser('d')[0].role, 'driver');
  assert.deepEqual(access.getForUser('extraño'), []);
});
test('US22 adaptador: detecta reservas y asientos ya ocupados', t => {
  const { write, access } = fixture(t);
  const route = { id: '1', seats: 3, initialSeats: 4 };
  assert.equal(access.hasReservations(route), true);
  route.seats = 4;
  assert.equal(access.hasReservations(route), false);
  write('bookings.json', [{ routeId: '1', status: 'confirmada' }]);
  assert.equal(access.hasReservations(route), true);
  write('bookings.json', [{ routeId: '1', status: 'cancelada' }]);
  assert.equal(access.hasReservations(route), false);
  write('reservations.json', [{ routeId: '1', status: 'confirmada', demo: false }]);
  assert.equal(access.hasReservations(route), false);
  write('reservations.json', []);
  write('tripHistory.json', [{ routeId: '1', cancelled: false }]);
  assert.equal(access.hasReservations(route), false);
});
test('US36 DAO: persiste tras nueva instancia y no sobrescribe JSON dañado', t => {
  const { directory } = fixture(t);
  const dao = new ReportRepository(directory);
  dao.save({ id: 'a', passengerId: 'p', requestId: 'r', code: 'REC-test' });
  assert.equal(new ReportRepository(directory).findRequest('p', 'r').code, 'REC-test');
  assert.equal(dao.findRequest('otro', 'r'), undefined);
  fs.writeFileSync(dao.filename, 'JSON dañado');
  assert.throws(() => dao.save({ id: 'b' }));
  assert.equal(fs.readFileSync(dao.filename, 'utf8'), 'JSON dañado');
});
