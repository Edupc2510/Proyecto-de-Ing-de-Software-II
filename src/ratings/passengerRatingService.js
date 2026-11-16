// ratings/passengerRatingService.js
// ─────────────────────────────────────────────────────────────
// Lógica de negocio de la US25 (el conductor califica al pasajero).
// Capa de SERVICIO: sin HTTP ni archivos. Dependencias inyectadas (DIP):
//
//   reservas       -> FuenteReservas (ReservaViajeAdapter)
//   calificaciones -> { guardar, buscarDuplicada, listarEmitidas } (CalificacionPasajeroDAO)
//   usuarios       -> { buscarPorId } (UsuarioRepositorioAdapter)
//   reloj          -> () => ms
//
// Orden de validación (falla rápido, de lo más barato a lo más costoso):
//   1) reserva indicada y valor de la calificación   -> escenario 03
//   2) la reserva existe y es de una ruta del conductor
//   3) el pasajero existe                            -> escenario 02
//   4) reserva confirmada y viaje terminado          -> escenario 01
//   5) no existe una calificación previa             -> escenario 04
//   6) se guarda; si falla, no queda nada guardado   -> escenario 05
// ─────────────────────────────────────────────────────────────

const { DomainError } = require('../shared/httpHelpers');
const { RATING_MIN, RATING_MAX, MAX_COMENTARIO, crearCalificacion } = require('./passengerRatingRecord');

const ESTADO = Object.freeze({ POR_CALIFICAR: 'por_calificar', EN_CURSO: 'en_curso', CALIFICADO: 'calificado' });
const ORDEN_ESTADO = { [ESTADO.POR_CALIFICAR]: 0, [ESTADO.EN_CURSO]: 1, [ESTADO.CALIFICADO]: 2 };

class CalificacionService {
  constructor({ reservas, calificaciones, usuarios, reloj = Date.now }) {
    this.reservas = reservas;
    this.calificaciones = calificaciones;
    this.usuarios = usuarios;
    this.reloj = reloj;
  }

  /**
   * Registra la calificación del conductor al pasajero de una reserva.
   * @returns {object} la calificación guardada
   */
  calificar(driverId, { bookingId, score, comment } = {}) {
    const entrada = this.#validarEntrada({ bookingId, score, comment });

    const reserva = this.reservas.buscarReserva(bookingId);
    if (!reserva || reserva.driverId !== String(driverId)) {
      throw new DomainError('No encontramos esa reserva entre los viajes que conduces.', 404);
    }
    if (!this.usuarios.buscarPorId(reserva.passengerId)) {
      throw new DomainError('El pasajero no existe.', 404);
    }
    if (!this.reservas.estaConfirmada(reserva)) {
      throw new DomainError('No puedes calificar a un pasajero cuya reserva fue cancelada.', 409);
    }
    if (!this.reservas.haTerminado(reserva, this.reloj())) {
      throw new DomainError('Solo puedes calificar al pasajero cuando el viaje haya finalizado.', 409);
    }
    if (this.calificaciones.buscarDuplicada({ routeId: reserva.routeId, driverId, passengerId: reserva.passengerId })) {
      throw new DomainError('Ya calificaste a este pasajero por este viaje.', 409);
    }

    return this.calificaciones.guardar(crearCalificacion({ booking: reserva, driverId, ...entrada }));
  }

  /**
   * Pasajeros de las rutas del conductor con su estado de calificación:
   *  por_calificar (viaje terminado) · en_curso (aún no termina) · calificado.
   */
  viajesPorCalificar(driverId) {
    const ahora = this.reloj();
    return this.reservas.listarDelConductor(driverId)
      .filter(reserva => this.reservas.estaConfirmada(reserva))
      .map(reserva => {
        const previa = this.calificaciones.buscarDuplicada({ routeId: reserva.routeId, driverId, passengerId: reserva.passengerId });
        const estado = previa ? ESTADO.CALIFICADO : this.reservas.haTerminado(reserva, ahora) ? ESTADO.POR_CALIFICAR : ESTADO.EN_CURSO;
        return {
          bookingId: reserva.id,
          routeId: reserva.routeId,
          passengerId: reserva.passengerId,
          passengerName: this.#nombreDe(reserva.passengerId, 'Pasajero'),
          origin: reserva.routeSnapshot?.origin || '',
          dest: reserva.routeSnapshot?.dest || '',
          time: reserva.routeSnapshot?.time || '',
          ratingStatus: estado,
          rating: previa ? { score: previa.score, comment: previa.comment } : null,
        };
      })
      .sort((a, b) => ORDEN_ESTADO[a.ratingStatus] - ORDEN_ESTADO[b.ratingStatus]);
  }

  /** Historial de calificaciones emitidas (la HU pide poder visualizarlas). */
  calificacionesEmitidas(driverId) {
    return this.calificaciones.listarEmitidas(driverId)
      .map(c => ({ ...c, passengerName: this.#nombreDe(c.rateeId, 'Pasajero') }));
  }

  // ───────────────────── Internos ─────────────────────

  #validarEntrada({ bookingId, score, comment }) {
    if (!bookingId || String(bookingId).trim() === '') {
      throw new DomainError('No se indicó el viaje a calificar.', 400);
    }
    if (!Number.isInteger(score) || score < RATING_MIN || score > RATING_MAX) {
      throw new DomainError(`La calificación debe ser un número entero entre ${RATING_MIN} y ${RATING_MAX}.`, 400);
    }
    const texto = comment === undefined || comment === null ? '' : comment;
    if (typeof texto !== 'string' || texto.trim().length > MAX_COMENTARIO) {
      throw new DomainError(`El comentario no puede superar los ${MAX_COMENTARIO} caracteres.`, 400);
    }
    return { score, comment: texto.trim() };
  }

  #nombreDe(userId, porDefecto) {
    const usuario = this.usuarios.buscarPorId(userId);
    return usuario ? `${usuario.firstName || ''} ${usuario.lastName || ''}`.trim() || porDefecto : porDefecto;
  }
}

module.exports = { CalificacionService, ESTADO };
