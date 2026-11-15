// reservations/bookingAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: otro integrante del equipo implementa las reservas de rutas
// (US14) en src/trips/bookingModel.js con su propia interfaz:
//   getBookingsByPassenger(id), findBookingById(id), getBookings(), saveBookings()
// y con su propio formato (routeSnapshot, expiresAtTimestamp, sin conductor
// ni participación).
//
// El servicio de reservas (US17/US35) espera la interfaz "Target" de una
// fuente de reservas:
//   listarPorPasajero(passengerId), buscarDelPasajero(passengerId, id),
//   actualizar(id, cambios)
//
// Solución: BookingAdapter implementa la interfaz esperada y traduce cada
// llamada hacia bookingModel (Adaptee) sin modificar su código. Así, cuando
// se mezclen las ramas, las reservas reales aparecerán en "Mis reservas" sin
// tocar el servicio ni el frontend.
//
//   Cliente  -> ReservaService
//   Target   -> fuente de reservas (misma interfaz que ReservaDAO)
//   Adapter  -> BookingAdapter
//   Adaptee  -> src/trips/bookingModel.js (rama de US14)
// ─────────────────────────────────────────────────────────────

const { RESERVATION_STATUS, PARTICIPATION_STATUS } = require('./reservationModel');

class BookingAdapter {
  /**
   * @param {object} bookingModel - módulo src/trips/bookingModel.js
   * @param {object} [userModel] - para resolver el nombre del conductor
   */
  constructor(bookingModel, userModel = null) {
    this.bookingModel = bookingModel;
    this.userModel = userModel;
    this.origen = 'bookings';
  }

  listarPorPasajero(passengerId) {
    return this.bookingModel.getBookingsByPassenger(passengerId).map(b => this.#aReserva(b));
  }

  buscarDelPasajero(passengerId, reservaId) {
    const booking = this.bookingModel.findBookingById(reservaId);
    if (!booking || String(booking.passengerId) !== String(passengerId)) return null;
    return this.#aReserva(booking);
  }

  /**
   * Traduce la actualización (ej. participación) al formato del booking.
   * Los campos extra se guardan dentro del mismo registro de bookings.json.
   */
  actualizar(reservaId, cambios) {
    const bookings = this.bookingModel.getBookings();
    const index = bookings.findIndex(b => String(b.id) === String(reservaId));
    if (index === -1) return null;
    bookings[index] = { ...bookings[index], ...cambios, updatedAt: new Date().toISOString() };
    if (!this.bookingModel.saveBookings(bookings)) {
      throw new Error('No se pudo actualizar la reserva.');
    }
    return this.#aReserva(bookings[index]);
  }

  /** Traducción del formato del Adaptee al formato que espera el cliente */
  #aReserva(booking) {
    const snap = booking.routeSnapshot || {};
    const conductor = this.#buscarConductor(booking.driverId);
    const status = booking.status === 'cancelada' ? RESERVATION_STATUS.CANCELLED : RESERVATION_STATUS.CONFIRMED;

    return {
      id: booking.id,
      passengerId: String(booking.passengerId),
      requestId: null,
      routeId: booking.routeId,
      driverId: booking.driverId,
      driver: {
        name: conductor ? `${conductor.firstName || ''} ${conductor.lastName || ''}`.trim() : 'Conductor MoveShare',
        phone: conductor?.phone || null,
        email: conductor?.email || null,
        vehicle: conductor?.vehicle || null,
      },
      route: {
        origin: snap.origin || '',
        dest: snap.dest || '',
        time: snap.time || '',
        departureAt: snap.expiresAtTimestamp ? new Date(snap.expiresAtTimestamp).toISOString() : null,
      },
      seats: 1,
      price: null,
      status,
      participation: booking.participation || { status: PARTICIPATION_STATUS.PENDING, updatedAt: booking.createdAt, note: null },
      cancelReason: booking.cancelReason || null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt || booking.createdAt,
      fuente: this.origen,
    };
  }

  #buscarConductor(driverId) {
    if (!driverId || !this.userModel) return null;
    try {
      return this.userModel.findUserById(driverId);
    } catch {
      return null;
    }
  }
}

module.exports = { BookingAdapter };
