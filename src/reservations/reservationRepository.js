// reservations/reservationRepository.js
// Punto único de acceso a las reservas para US17, US30, US35 y US37.
// Las reservas viven en el modelo de la US14 (data/bookings.json); este
// repositorio las obtiene a través del BookingAdapter. Recibe las fuentes
// por constructor para poder probarlo con datos en memoria.

const bookingModel = require('../trips/bookingModel');
const userModel = require('../auth/userModel');
const { BookingAdapter } = require('./bookingAdapter');

class ReservaRepositorio {
  constructor(fuentes) {
    this.fuentes = fuentes;
  }

  static crearPorDefecto() {
    return new ReservaRepositorio([new BookingAdapter(bookingModel, userModel)]);
  }

  listarPorPasajero(passengerId) {
    return this.fuentes.flatMap(fuente =>
      fuente.listarPorPasajero(passengerId).map(r => ({ ...r, fuente: fuente.origen }))
    );
  }

  buscarDelPasajero(passengerId, reservaId) {
    for (const fuente of this.fuentes) {
      const reserva = fuente.buscarDelPasajero(passengerId, reservaId);
      if (reserva) return { ...reserva, fuente: fuente.origen };
    }
    return null;
  }

  actualizar(reserva, cambios) {
    const fuente = this.fuentes.find(f => f.origen === reserva.fuente) || this.fuentes[0];
    const actualizada = fuente.actualizar(reserva.id, cambios);
    return actualizada ? { ...actualizada, fuente: fuente.origen } : null;
  }
}

module.exports = { ReservaRepositorio };
