// ratings/bookingTripAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: para calificar a un pasajero hay que saber qué reservas tiene el
// conductor, quién viajó y si el viaje ya terminó. Esos datos los producen la
// US14 (trips/bookingModel.js: funciones sueltas sobre bookings.json) y la
// regla de "viaje finalizado" de la US24 (isTripFinished). El servicio de
// calificaciones no debe conocer esos módulos ni sus formatos (DIP).
//
// Solución: ReservaViajeAdapter implementa la interfaz que el servicio espera
// ("FuenteReservas") y delega en esos módulos SIN modificarlos. Reutiliza la
// MISMA regla de viaje finalizado que la US24 (DRY): no se redefine.
//
//   Cliente  -> CalificacionService
//   Target   -> FuenteReservas { buscarReserva, listarDelConductor,
//                                 estaConfirmada, haTerminado }
//   Adapter  -> ReservaViajeAdapter
//   Adaptee  -> trips/bookingModel (US14) + ratings/driverRatingController.isTripFinished (US24)
// ─────────────────────────────────────────────────────────────

class ReservaViajeAdapter {
  /**
   * @param {{ bookingModel?: object, esViajeFinalizado?: Function }} [deps] - inyectables en pruebas
   */
  constructor({
    bookingModel = require('../trips/bookingModel'),
    esViajeFinalizado = require('./driverRatingController').isTripFinished,
  } = {}) {
    this.bookingModel = bookingModel;
    this.esViajeFinalizado = esViajeFinalizado;
  }

  buscarReserva(bookingId) {
    return this.bookingModel.findBookingById(bookingId);
  }

  /** Reservas de las rutas que publicó el conductor. */
  listarDelConductor(driverId) {
    return this.bookingModel.getBookings().filter(b => b.driverId === String(driverId));
  }

  estaConfirmada(reserva) {
    return reserva.status === this.bookingModel.BOOKING_STATUS.CONFIRMED;
  }

  haTerminado(reserva, ahora) {
    return this.esViajeFinalizado(reserva, ahora);
  }
}

module.exports = { ReservaViajeAdapter };
