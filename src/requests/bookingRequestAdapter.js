// requests/bookingRequestAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural) - US15
// ─────────────────────────────────────────────────────────────
// Las solicitudes de viaje se guardan con el modelo de la US14
// (src/trips/bookingModel.js). Este adapter presenta cada booking como una
// "solicitud" (estado, conductor, ruta, historial) con la interfaz que usa
// SolicitudService:
//   listarPorPasajero(passengerId), buscarDelPasajero(passengerId, id),
//   cancelar(id, nota)
// Así US15 no crea un segundo modelo de solicitudes.
// ─────────────────────────────────────────────────────────────

const { REQUEST_STATUS, DESDE_BOOKING } = require('./requestModel');
const { datosConductor } = require('../reservations/bookingAdapter');

class BookingSolicitudAdapter {
  constructor(bookingModel, userModel = null) {
    this.bookingModel = bookingModel;
    this.userModel = userModel;
  }

  static crearPorDefecto() {
    return new BookingSolicitudAdapter(require('../trips/bookingModel'), require('../auth/userModel'));
  }

  listarPorPasajero(passengerId) {
    return this.bookingModel.getBookingsByPassenger(passengerId).map(b => this.#aSolicitud(b));
  }

  buscarDelPasajero(passengerId, solicitudId) {
    const booking = this.bookingModel.findBookingById(solicitudId);
    return booking && String(booking.passengerId) === String(passengerId) ? this.#aSolicitud(booking) : null;
  }

  /** Cancela la solicitud marcando el booking como cancelado por el pasajero. */
  cancelar(solicitudId, nota) {
    const bookings = this.bookingModel.getBookings();
    const index = bookings.findIndex(b => String(b.id) === String(solicitudId));
    if (index === -1) return null;

    const ahora = new Date().toISOString();
    const booking = bookings[index];
    bookings[index] = {
      ...booking,
      status: 'cancelada',
      cancelledAt: ahora,
      cancelledBy: 'pasajero',
      cancelReason: nota,
      history: [...(booking.history || []), { status: 'cancelada', at: ahora, note: nota }],
    };
    if (!this.bookingModel.saveBookings(bookings)) throw new Error('No se pudo cancelar la solicitud.');
    return this.#aSolicitud(bookings[index]);
  }

  #aSolicitud(booking) {
    const snap = booking.routeSnapshot || {};
    const status = DESDE_BOOKING[booking.status] || REQUEST_STATUS.PENDING;
    const conductor = datosConductor(booking, this.userModel);

    return {
      id: booking.id,
      passengerId: String(booking.passengerId),
      routeId: booking.routeId,
      driverId: booking.driverId,
      driver: { name: conductor.name },
      route: {
        origin: snap.origin || '',
        dest: snap.dest || '',
        time: snap.time || '',
        departureAt: snap.expiresAtTimestamp ? new Date(snap.expiresAtTimestamp).toISOString() : null,
      },
      seatsRequested: Number(booking.seats) || 1,
      pickupAddress: booking.pickupPoint?.address || null,
      message: booking.message || '',
      status,
      cancelledBy: booking.cancelledBy || (status === REQUEST_STATUS.CANCELLED ? 'conductor' : null),
      responseNote: booking.responseNote || booking.cancelReason || null,
      history: this.#historial(booking, status),
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt || booking.cancelledAt || booking.createdAt,
    };
  }

  /** Usa el historial guardado o lo reconstruye a partir de las fechas del booking. */
  #historial(booking, status) {
    const traducir = h => ({ ...h, status: DESDE_BOOKING[h.status] || h.status });
    if (Array.isArray(booking.history) && booking.history.length) {
      const guardado = booking.history.map(traducir);
      if (guardado[0].status !== REQUEST_STATUS.PENDING) {
        guardado.unshift({ status: REQUEST_STATUS.PENDING, at: booking.createdAt, note: 'Solicitud enviada al conductor.' });
      }
      return guardado;
    }
    const historial = [{ status: REQUEST_STATUS.PENDING, at: booking.createdAt, note: 'Solicitud enviada al conductor.' }];
    if (status === REQUEST_STATUS.ACCEPTED) {
      historial.push({ status, at: booking.createdAt, note: 'Te uniste a la ruta y tu asiento quedó reservado.' });
    } else if (status === REQUEST_STATUS.CANCELLED) {
      historial.push({ status, at: booking.cancelledAt || booking.updatedAt || booking.createdAt, note: booking.cancelReason || null });
    } else if (status === REQUEST_STATUS.REJECTED) {
      historial.push({ status, at: booking.updatedAt || booking.createdAt, note: booking.responseNote || null });
    }
    return historial;
  }
}

module.exports = { BookingSolicitudAdapter };
