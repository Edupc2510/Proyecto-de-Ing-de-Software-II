// reservations/bookingAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: las reservas reales del sistema se guardan con el modelo de la
// US14 (src/trips/bookingModel.js, data/bookings.json), cuya interfaz es:
//   getBookingsByPassenger(id), findBookingById(id), getBookings(), saveBookings()
// y cuyo formato es distinto (routeSnapshot, expiresAtTimestamp, sin datos
// del conductor ni de participación).
//
// El servicio de reservas (US17/US35) espera la interfaz "Target":
//   listarPorPasajero(passengerId), buscarDelPasajero(passengerId, id),
//   actualizar(id, cambios)
//
// Solución: BookingAdapter implementa la interfaz esperada y traduce cada
// llamada hacia bookingModel (Adaptee) sin modificar su código ni crear un
// segundo modelo de reservas.
//
//   Cliente  -> ReservaService
//   Target   -> fuente de reservas
//   Adapter  -> BookingAdapter
//   Adaptee  -> src/trips/bookingModel.js (US14)
// ─────────────────────────────────────────────────────────────

const { RESERVATION_STATUS, PARTICIPATION_STATUS } = require('./reservationModel');

/**
 * Un booking es una "reserva" si fue confirmado (aunque luego se cancelara).
 * Una solicitud pendiente, rechazada o cancelada por el pasajero antes de ser
 * aceptada no es una reserva: solo se ve en US15.
 */
function esReserva(booking) {
  if (booking.status === RESERVATION_STATUS.CONFIRMED) return true;
  if (booking.status !== RESERVATION_STATUS.CANCELLED) return false;
  const historial = Array.isArray(booking.history) ? booking.history : null;
  const canceloSolicitud = booking.cancelledBy === 'pasajero' && historial && !historial.some(h => h.status === RESERVATION_STATUS.CONFIRMED);
  return !canceloSolicitud;
}

class BookingAdapter {
  /**
   * @param {object} bookingModel - módulo src/trips/bookingModel.js
   * @param {object} [userModel] - para resolver los datos del conductor
   */
  constructor(bookingModel, userModel = null) {
    this.bookingModel = bookingModel;
    this.userModel = userModel;
    this.origen = 'bookings';
  }

  listarPorPasajero(passengerId) {
    return this.bookingModel.getBookingsByPassenger(passengerId)
      .filter(esReserva)
      .map(b => this.#aReserva(b));
  }

  buscarDelPasajero(passengerId, reservaId) {
    const booking = this.bookingModel.findBookingById(reservaId);
    if (!booking || String(booking.passengerId) !== String(passengerId) || !esReserva(booking)) return null;
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
    const conductor = datosConductor(booking, this.userModel);

    return {
      id: booking.id,
      passengerId: String(booking.passengerId),
      routeId: booking.routeId,
      driverId: booking.driverId,
      driver: conductor,
      route: {
        origin: snap.origin || '',
        dest: snap.dest || '',
        time: snap.time || '',
        departureAt: snap.expiresAtTimestamp ? new Date(snap.expiresAtTimestamp).toISOString() : null,
      },
      seats: Number(booking.seats) || 1,
      price: booking.price ?? null,
      status: booking.status,
      participation: booking.participation || { status: PARTICIPATION_STATUS.PENDING, updatedAt: booking.createdAt, note: null },
      cancelReason: booking.cancelReason || null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt || booking.createdAt,
      fuente: this.origen,
    };
  }
}

/**
 * Datos del conductor: primero el usuario registrado; si no existe, la "foto"
 * guardada en el booking (driverSnapshot, usada por los datos de demostración).
 */
function datosConductor(booking, userModel) {
  let registrado = null;
  if (booking.driverId && userModel) {
    try { registrado = userModel.findUserById(booking.driverId); } catch { registrado = null; }
  }
  const snap = booking.driverSnapshot || {};
  return {
    name: registrado ? `${registrado.firstName || ''} ${registrado.lastName || ''}`.trim() : snap.name || 'Conductor MoveShare',
    phone: registrado?.phone || snap.phone || null,
    email: registrado?.email || snap.email || null,
    vehicle: registrado?.vehicle || snap.vehicle || null,
  };
}

module.exports = { BookingAdapter, datosConductor };
