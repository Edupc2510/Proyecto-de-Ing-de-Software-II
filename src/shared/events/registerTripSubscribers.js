// shared/events/registerTripSubscribers.js
// Punto único donde se conectan los observadores con el bus de eventos de
// viaje (patrón Observer). Se llama una vez al iniciar la app (app.js).
// Para agregar una reacción nueva basta con registrar otro observador aquí.

const { tripEvents } = require('./tripEvents');
const { registerNotificationObserver } = require('../../notifications/notificationSubscriber');
const { registerReliabilityObserver } = require('../../trips/reliabilitySubscriber');

let registered = false;

function registerTripSubscribers(bus = tripEvents) {
  if (registered && bus === tripEvents) return bus; // evita suscribir dos veces
  registerNotificationObserver(bus);
  registerReliabilityObserver(bus);
  if (bus === tripEvents) registered = true;
  return bus;
}

module.exports = registerTripSubscribers;
