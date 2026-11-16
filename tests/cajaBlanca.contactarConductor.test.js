// tests/cajaBlanca.contactarConductor.test.js
// ─────────────────────────────────────────────────────────────
// PRUEBA DE CAJA BLANCA - US30 Contactar conductores frecuentes
// Método: ConductorFrecuenteService.contactar(pasajero, driverId, claveCanal, mensaje)
// Archivo: src/drivers/frequentDriverService.js
//
// Complejidad ciclomática V(G) = 7
//   - Nodos predicado: !conductor, !canal, !estaDisponible, try/catch,
//     error.validacion, clave !== 'mensaje'  → 6 + 1 = 7
//   - Grafo de flujo: E = 20 aristas, N = 15 nodos → 20 - 15 + 2 = 7
//
// Se prueba un camino independiente por cada caso (cobertura de caminos básicos):
//   CB-01  1-2-3-15                    conductor no frecuente           → error 403
//   CB-02  1-2-4-5-15                  canal inexistente                → error 400
//   CB-03  1-2-4-6-7-15                canal no disponible              → error 409
//   CB-04  1-2-4-6-8-9-10-15           mensaje interno vacío            → error 400 (validación)
//   CB-05  1-2-4-6-8-9-11-15           error inesperado de la estrategia → se propaga sin cambios
//   CB-06  1-2-4-6-8-12-14-15          mensaje interno correcto         → sin auditoría extra
//   CB-07  1-2-4-6-8-12-13-14-15       WhatsApp correcto                → enlace + auditoría
// ─────────────────────────────────────────────────────────────
require('./helpers/tempDataDir');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const { ConductorFrecuenteService } = require('../src/drivers/frequentDriverService');
const { ContactoConductorDAO } = require('../src/drivers/driverContactDAO');
const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { BookingAdapter } = require('../src/reservations/bookingAdapter');
const { DomainError } = require('../src/shared/httpHelpers');
const { crearFakeBookingModel, datosBooking } = require('./helpers/fakeBookingModel');

const DIA = 24 * 3600e3;
const pasajero = { id: 'p1', name: 'Eduardo' };
const CARLA = { id: 'd1', name: 'Carla', phone: '987654321', email: null };
const JORGE = { id: 'd2', name: 'Jorge', phone: '912345678', email: null };

describe('Caja blanca · ConductorFrecuenteService.contactar() · V(G) = 7', () => {
  let service;
  let contactoDAO;

  beforeEach(() => {
    const modelo = crearFakeBookingModel();
    const viaje = (c, offset) => modelo.agregar(datosBooking({
      driverId: c.id, offsetMs: offset, driverSnapshot: { name: c.name, phone: c.phone, email: c.email },
    }));
    viaje(CARLA, -1 * DIA); // Carla: 2 viajes completados → frecuente
    viaje(CARLA, -3 * DIA);
    viaje(JORGE, -2 * DIA); // Jorge: 1 viaje → NO frecuente

    contactoDAO = new ContactoConductorDAO();
    contactoDAO.eliminarDonde(() => true);
    service = new ConductorFrecuenteService({ repositorio: new ReservaRepositorio([new BookingAdapter(modelo)]), contactoDAO });
  });

  it('CB-01 · camino 1-2-3: conductor que no es frecuente → DomainError 403', () => {
    assert.throws(
      () => service.contactar(pasajero, JORGE.id, 'whatsapp', 'Hola'),
      e => e instanceof DomainError && e.status === 403
    );
  });

  it('CB-02 · camino 1-2-4-5: canal que no existe → DomainError 400', () => {
    assert.throws(
      () => service.contactar(pasajero, CARLA.id, 'telegram', 'Hola'),
      e => e instanceof DomainError && e.status === 400 && /canal de contacto no es válido/.test(e.message)
    );
  });

  it('CB-03 · camino 1-2-4-6-7: canal no disponible (correo sin email) → DomainError 409', () => {
    assert.throws(
      () => service.contactar(pasajero, CARLA.id, 'correo', 'Hola'),
      e => e instanceof DomainError && e.status === 409
    );
  });

  it('CB-04 · camino 1-2-4-6-8-9-10: mensaje interno vacío → error de validación 400', () => {
    assert.throws(
      () => service.contactar(pasajero, CARLA.id, 'mensaje', '   '),
      e => e instanceof DomainError && e.status === 400 && /Escribe un mensaje/.test(e.message)
    );
  });

  it('CB-05 · camino 1-2-4-6-8-9-11: error inesperado de la estrategia → se propaga sin transformar', () => {
    const errorInterno = new Error('Fallo de infraestructura');
    service.fabricaCanales = {
      crearCanal: () => ({ clave: 'x', etiqueta: 'X', estaDisponible: () => true, contactar: () => { throw errorInterno; } }),
    };
    assert.throws(() => service.contactar(pasajero, CARLA.id, 'x', 'Hola'), e => e === errorInterno);
  });

  it('CB-06 · camino 1-2-4-6-8-12-14: mensaje interno correcto → se guarda una sola vez', () => {
    const r = service.contactar(pasajero, CARLA.id, 'mensaje', '¿Tienes cupo mañana?');
    assert.strictEqual(r.tipo, 'mensaje');
    assert.strictEqual(r.canal, 'mensaje');
    assert.strictEqual(contactoDAO.listarConversacion('p1', CARLA.id).length, 1);
  });

  it('CB-07 · camino 1-2-4-6-8-12-13-14: WhatsApp correcto → enlace wa.me y registro de auditoría', () => {
    const r = service.contactar(pasajero, CARLA.id, 'whatsapp', 'Hola');
    assert.strictEqual(r.tipo, 'enlace');
    assert.match(r.url, /^https:\/\/wa\.me\/51987654321\?text=Hola$/);
    const historial = contactoDAO.listarConversacion('p1', CARLA.id);
    assert.strictEqual(historial.length, 1);
    assert.strictEqual(historial[0].canal, 'whatsapp');
  });
});
