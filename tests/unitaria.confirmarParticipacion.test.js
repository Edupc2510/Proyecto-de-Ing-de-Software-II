// tests/unitaria.confirmarParticipacion.test.js
// ─────────────────────────────────────────────────────────────
// PRUEBA UNITARIA - US35 Confirmar participación en el viaje
// Método: ReservaService.confirmarParticipacion(passengerId, reservaId)
// Archivo: src/reservations/reservationService.js
// Dependencias reemplazadas: bookingModel en memoria (sin tocar data/bookings.json)
// y carpeta de datos temporal para el historial de comandos.
//
//   UT-01  Reserva vigente con participación pendiente → queda "confirmada"
//   UT-02  El pasajero había declinado → puede cambiar de opinión y confirmar
//   UT-03  Participación ya confirmada → error 409
//   UT-04  Reserva cancelada por el conductor → error 409
//   UT-05  El viaje ya salió → error 409
//   UT-06  Reserva de otro pasajero → error 404 (no revela la reserva ajena)
// ─────────────────────────────────────────────────────────────
require('./helpers/tempDataDir');
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const { ReservaService } = require('../src/reservations/reservationService');
const { ReservaRepositorio } = require('../src/reservations/reservationRepository');
const { BookingAdapter } = require('../src/reservations/bookingAdapter');
const { DomainError } = require('../src/shared/httpHelpers');
const { crearFakeBookingModel, datosBooking } = require('./helpers/fakeBookingModel');

const HORA = 3600e3;

describe('Prueba unitaria · ReservaService.confirmarParticipacion()', () => {
  let modelo;
  let service;

  beforeEach(() => {
    modelo = crearFakeBookingModel();
    service = new ReservaService({ repositorio: new ReservaRepositorio([new BookingAdapter(modelo)]) });
  });

  it('UT-01 · reserva vigente y pendiente → participación confirmada', () => {
    const b = modelo.agregar(datosBooking({ offsetMs: 3 * HORA }));
    const vista = service.confirmarParticipacion('p1', b.id);
    assert.strictEqual(vista.participacion.codigo, 'confirmada');
    assert.strictEqual(vista.acciones.puedeConfirmar, false);
    assert.strictEqual(vista.acciones.puedeDeshacer, true);
    assert.strictEqual(modelo.findBookingById(b.id).participation.status, 'confirmada');
  });

  it('UT-02 · el pasajero había declinado → puede confirmar de nuevo', () => {
    const b = modelo.agregar(datosBooking({ offsetMs: 3 * HORA, participation: { status: 'declinada', note: 'Examen' } }));
    assert.strictEqual(service.confirmarParticipacion('p1', b.id).participacion.codigo, 'confirmada');
  });

  it('UT-03 · participación ya confirmada → error 409', () => {
    const b = modelo.agregar(datosBooking({ offsetMs: 3 * HORA, participation: { status: 'confirmada' } }));
    assert.throws(
      () => service.confirmarParticipacion('p1', b.id),
      e => e instanceof DomainError && e.status === 409 && /Ya confirmaste/.test(e.message)
    );
  });

  it('UT-04 · reserva cancelada por el conductor → error 409', () => {
    const b = modelo.agregar(datosBooking({ offsetMs: 3 * HORA, status: 'cancelada', cancelReason: 'Ruta cancelada' }));
    assert.throws(
      () => service.confirmarParticipacion('p1', b.id),
      e => e instanceof DomainError && e.status === 409 && /cancelada/.test(e.message)
    );
  });

  it('UT-05 · el viaje ya salió → error 409', () => {
    const b = modelo.agregar(datosBooking({ offsetMs: -HORA }));
    assert.throws(
      () => service.confirmarParticipacion('p1', b.id),
      e => e instanceof DomainError && e.status === 409 && /ya salió/.test(e.message)
    );
  });

  it('UT-06 · reserva de otro pasajero → error 404', () => {
    const b = modelo.agregar(datosBooking({ passengerId: 'otro', offsetMs: 3 * HORA }));
    assert.throws(
      () => service.confirmarParticipacion('p1', b.id),
      e => e instanceof DomainError && e.status === 404
    );
    assert.strictEqual(modelo.findBookingById(b.id).participation, undefined);
  });
});
