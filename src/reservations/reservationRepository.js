// reservations/reservationRepository.js
// Une todas las fuentes de reservas detrás de una sola interfaz:
//   1. ReservaDAO (reservations.json) -> reservas propias de este módulo.
//   2. BookingAdapter (bookings.json)  -> reservas creadas por la US14 del
//      equipo, solo si src/trips/bookingModel.js existe en la rama.
// El servicio de reservas no sabe de cuántas fuentes vienen los datos.

const { ReservaDAO } = require('./reservationDAO');
const { BookingAdapter } = require('./bookingAdapter');

/**
 * Carga un módulo opcional: si todavía no existe en esta rama, devuelve null.
 */
function requireOpcional(ruta) {
  try {
    return require(ruta);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      if (!String(error.message).includes(ruta.replace('../', ''))) {
        console.warn(`[ReservaRepositorio] ${ruta} existe pero falta una de sus dependencias:`, error.message);
      }
      return null;
    }
    throw error;
  }
}

class ReservaRepositorio {
  constructor(fuentes) {
    this.fuentes = fuentes;
  }

  /**
   * Arma el repositorio con las fuentes disponibles en el proyecto.
   */
  static crearPorDefecto() {
    const dao = new ReservaDAO();
    dao.origen = 'moveshare';
    const fuentes = [dao];

    const bookingModel = requireOpcional('../trips/bookingModel');
    if (bookingModel && typeof bookingModel.getBookingsByPassenger === 'function') {
      const userModel = requireOpcional('../auth/userModel');
      fuentes.push(new BookingAdapter(bookingModel, userModel));
    }
    return new ReservaRepositorio(fuentes);
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
