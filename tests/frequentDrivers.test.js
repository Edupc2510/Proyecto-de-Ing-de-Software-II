// tests/frequentDrivers.test.js - US30 (Strategy + Factory Method)
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { FabricaCanalContacto, CanalWhatsApp, normalizarTelefonoPeru } = require('../src/drivers/contactChannels');
const { ContactoConductorDAO } = require('../src/drivers/driverContactDAO');
const { ConductorFrecuenteService } = require('../src/drivers/frequentDriverService');
const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { BookingAdapter } = require('../src/reservations/bookingAdapter');
const { crearFakeBookingModel, datosBooking } = require('./helpers/fakeBookingModel');

const DIA = 24 * 3600e3;
const conductor = { id: 'd1', name: 'Carla', phone: '987 654 321', email: null };
const pasajero = { id: 'p1', name: 'Eduardo' };

test('Factory Method + Strategy: cada canal resuelve el contacto a su manera', () => {
  const fabrica = new FabricaCanalContacto(new ContactoConductorDAO());
  const whatsapp = fabrica.crearCanal('whatsapp');
  assert.ok(whatsapp instanceof CanalWhatsApp);
  assert.match(whatsapp.contactar({ conductor, pasajero, mensaje: 'Hola' }).url, /^https:\/\/wa\.me\/51987654321\?text=Hola$/);
  assert.strictEqual(fabrica.crearCanal('llamada').contactar({ conductor }).url, 'tel:+51987654321');
  assert.strictEqual(fabrica.crearCanal('correo').estaDisponible(conductor), false);
  assert.strictEqual(fabrica.crearCanal('telegram'), null);
  assert.strictEqual(normalizarTelefonoPeru('12345'), null);
});

test('US30: solo los conductores con 2+ viajes completados son frecuentes y contactables', () => {
  const modelo = crearFakeBookingModel();
  const viaje = (driver, offset) => modelo.agregar(datosBooking({
    driverId: driver.id, offsetMs: offset, driverSnapshot: { name: driver.name, phone: driver.phone, email: driver.email },
  }));
  viaje(conductor, -1 * DIA);
  viaje(conductor, -3 * DIA);
  viaje({ id: 'd2', name: 'Jorge', phone: '912345678' }, -2 * DIA);

  const repositorio = new ReservaRepositorio([new BookingAdapter(modelo)]);
  const service = new ConductorFrecuenteService({ repositorio, contactoDAO: new ContactoConductorDAO() });
  const frecuentes = service.listar('p1');
  assert.strictEqual(frecuentes.length, 1);
  assert.strictEqual(frecuentes[0].viajesCompartidos, 2);
  assert.strictEqual(frecuentes[0].canales.find(c => c.clave === 'whatsapp').disponible, true);

  const resultado = service.contactar(pasajero, 'd1', 'mensaje', '¿Mañana tienes cupo?');
  assert.strictEqual(resultado.tipo, 'mensaje');
  assert.strictEqual(service.historial('p1', 'd1').contactos.length, 1);

  assert.throws(() => service.contactar(pasajero, 'd2', 'whatsapp'), /Solo puedes contactar/);
  assert.throws(() => service.contactar(pasajero, 'd1', 'correo'), /no tiene disponible/);
  assert.throws(() => service.contactar(pasajero, 'd1', 'mensaje', '   '), /Escribe un mensaje/);
});
