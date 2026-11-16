// Pruebas unitarias – patrón Factory de notificaciones (US14, US31, US34)
// Módulo probado: src/notifications/notificationFactory.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotificationFactory } = require('../src/notifications/notificationFactory');
const { NOTIFICATION_TYPES, PRIORITY } = require('../src/notifications/notificationModel');

const route = {
  id: 10, driverId: 'drv-1', time: '07:30',
  origin: 'Santiago de Surco, Lima, Perú', dest: 'San Isidro, Lima, Perú',
};

test('Factory crea el aviso de coincidencia de ruta (US31)', () => {
  const n = NotificationFactory.crear(NOTIFICATION_TYPES.ROUTE_MATCH, { route, alert: { id: 'a1', userId: 'pas-1' } });
  assert.equal(n.userId, 'pas-1');
  assert.equal(n.type, NOTIFICATION_TYPES.ROUTE_MATCH);
  assert.equal(n.priority, PRIORITY.NORMAL);
  assert.equal(n.alertId, 'a1');
  assert.match(n.message, /Santiago de Surco → San Isidro a las 07:30/);
});

test('Factory crea el aviso de nueva solicitud para el conductor (US14)', () => {
  const n = NotificationFactory.crear(NOTIFICATION_TYPES.NEW_REQUEST, { route, passengerName: 'Paula Pasajera' });
  assert.equal(n.userId, 'drv-1');
  assert.match(n.message, /^Paula Pasajera reservó un asiento/);
});

test('Factory usa "Un pasajero" si no hay nombre', () => {
  const n = NotificationFactory.crear(NOTIFICATION_TYPES.NEW_REQUEST, { route });
  assert.match(n.message, /^Un pasajero reservó/);
});

test('Factory crea el aviso de cancelación con prioridad alta y motivo (US34)', () => {
  const n = NotificationFactory.crear(NOTIFICATION_TYPES.ROUTE_CANCELLED, {
    route, booking: { passengerId: 'pas-2' }, reason: 'Auto en taller',
  });
  assert.equal(n.userId, 'pas-2');
  assert.equal(n.priority, PRIORITY.HIGH);
  assert.match(n.message, /Motivo: Auto en taller/);
});

test('Factory omite el motivo cuando no se indicó', () => {
  const n = NotificationFactory.crear(NOTIFICATION_TYPES.ROUTE_CANCELLED, { route, booking: { passengerId: 'pas-2' } });
  assert.doesNotMatch(n.message, /Motivo/);
});

test('Factory rechaza un tipo desconocido', () => {
  assert.throws(() => NotificationFactory.crear('tipo_inventado', {}), /desconocido/);
});
