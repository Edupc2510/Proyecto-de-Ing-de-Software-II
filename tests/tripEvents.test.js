// Pruebas unitarias – patrón Observer de eventos de viaje (US14, US31, US34)
// Módulos probados: src/shared/events/tripEvents.js y src/trips/reliabilitySubscriber.js
// Se usa un bus nuevo en cada prueba para no tocar el bus real de la app.

const test = require('node:test');
const assert = require('node:assert/strict');
const { TripEventBus, TRIP_EVENTS } = require('../src/shared/events/tripEvents');
const { registerReliabilityObserver } = require('../src/trips/reliabilitySubscriber');

test('publish avisa a todos los observadores del evento con los datos', () => {
  const bus = new TripEventBus();
  const recibidos = [];
  bus.subscribe(TRIP_EVENTS.ROUTE_PUBLISHED, 'obs1', (p) => recibidos.push(['obs1', p.route.id]));
  bus.subscribe(TRIP_EVENTS.ROUTE_PUBLISHED, 'obs2', (p) => recibidos.push(['obs2', p.route.id]));

  bus.publish(TRIP_EVENTS.ROUTE_PUBLISHED, { route: { id: 7 } });

  assert.deepEqual(recibidos, [['obs1', 7], ['obs2', 7]]);
});

test('publish solo avisa a los observadores de ese evento', () => {
  const bus = new TripEventBus();
  let llamado = false;
  bus.subscribe(TRIP_EVENTS.ROUTE_CANCELLED, 'obs', () => { llamado = true; });

  bus.publish(TRIP_EVENTS.BOOKING_CREATED, {});

  assert.equal(llamado, false);
});

test('si un observador falla, los demás igual reciben el evento', () => {
  const bus = new TripEventBus();
  let segundo = false;
  const originalError = console.error;
  console.error = () => {}; // silenciar el log esperado
  try {
    bus.subscribe(TRIP_EVENTS.ROUTE_CANCELLED, 'falla', () => { throw new Error('boom'); });
    bus.subscribe(TRIP_EVENTS.ROUTE_CANCELLED, 'ok', () => { segundo = true; });
    assert.doesNotThrow(() => bus.publish(TRIP_EVENTS.ROUTE_CANCELLED, {}));
  } finally {
    console.error = originalError;
  }
  assert.equal(segundo, true);
});

test('subscribe rechaza eventos desconocidos', () => {
  const bus = new TripEventBus();
  assert.throws(() => bus.subscribe('evento_inventado', 'x', () => {}), /desconocido/);
});

test('countObservers cuenta los observadores registrados', () => {
  const bus = new TripEventBus();
  assert.equal(bus.countObservers(TRIP_EVENTS.ROUTE_CANCELLED), 0);
  registerReliabilityObserver(bus);
  assert.equal(bus.countObservers(TRIP_EVENTS.ROUTE_CANCELLED), 1);
});

test('observador de fiabilidad: cancelar con tiempo (sin pasajeros o con >15 min) no lanza errores', () => {
  const bus = new TripEventBus();
  registerReliabilityObserver(bus);
  const now = Date.now();
  // Sin pasajeros → nunca hay strike; con 60 min de anticipación → tampoco
  assert.doesNotThrow(() => bus.publish(TRIP_EVENTS.ROUTE_CANCELLED, {
    route: { id: 1, expiresAtTimestamp: now + 5 * 60000 }, driverId: 'd', cancelledBookings: [], reason: '', cancelledAt: now,
  }));
  assert.doesNotThrow(() => bus.publish(TRIP_EVENTS.ROUTE_CANCELLED, {
    route: { id: 2, expiresAtTimestamp: now + 60 * 60000 }, driverId: 'd', cancelledBookings: [{}], reason: '', cancelledAt: now,
  }));
});
