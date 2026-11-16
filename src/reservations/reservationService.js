// reservations/reservationService.js
// Lógica de negocio de:
//   US17 - Visualizar reservas realizadas  (Strategy + Iterator + Adapter)
//   US35 - Confirmar participación en el viaje (Command)

const { ReservaRepositorio } = require('./reservationRepository');
const { ColeccionReservas } = require('./reservationCollection');
const { FILTROS, obtenerFiltro } = require('./reservationFilters');
const {
  GestorParticipacion,
  ConfirmarParticipacionCommand,
  DeclinarParticipacionCommand,
  InvocadorParticipacion,
} = require('./participationCommands');
const { RESERVATION_STATUS, PARTICIPATION_STATUS, horaDeSalida, estadoEfectivo } = require('./reservationModel');
const { DomainError } = require('../shared/httpHelpers');

const ETIQUETAS_RESERVA = {
  [RESERVATION_STATUS.CONFIRMED]: { etiqueta: 'Confirmada', tono: 'success' },
  [RESERVATION_STATUS.COMPLETED]: { etiqueta: 'Completada', tono: 'info' },
  [RESERVATION_STATUS.CANCELLED]: { etiqueta: 'Cancelada', tono: 'error' },
};

const ETIQUETAS_PARTICIPACION = {
  [PARTICIPATION_STATUS.PENDING]: { etiqueta: 'Por confirmar', tono: 'warning' },
  [PARTICIPATION_STATUS.CONFIRMED]: { etiqueta: 'Asistencia confirmada', tono: 'success' },
  [PARTICIPATION_STATUS.DECLINED]: { etiqueta: 'No asistirá', tono: 'error' },
};

// Si faltan menos de 24 h para salir y no confirmó, se resalta la reserva.
const VENTANA_RECORDATORIO_MS = 24 * 60 * 60 * 1000;

class ReservaService {
  constructor({ repositorio = ReservaRepositorio.crearPorDefecto(), invocador = new InvocadorParticipacion() } = {}) {
    this.repositorio = repositorio;
    this.invocador = invocador;
    this.gestor = new GestorParticipacion(repositorio);
  }

  // ───────────────────────────── US17 ─────────────────────────────

  listar(passengerId, claveFiltro = 'proximas') {
    const filtro = obtenerFiltro(claveFiltro);
    if (!filtro) throw new DomainError('El filtro de reservas no es válido.');

    const ahora = Date.now();
    const coleccion = new ColeccionReservas(this.repositorio.listarPorPasajero(passengerId), ahora);
    const logs = this.invocador.historial.buscar(r => String(r.passengerId) === String(passengerId) && !r.undone);

    // El cliente recorre la colección con el iterador; no conoce su estructura.
    const reservas = [];
    const iterador = coleccion.crearIterador(filtro);
    while (iterador.hasNext()) {
      const reserva = iterador.next();
      const tieneDeshacer = logs.some(l => String(l.reservationId) === String(reserva.id));
      reservas.push(this.#aVista(reserva, ahora, tieneDeshacer));
    }

    return {
      filtro: filtro.clave,
      contadores: FILTROS.reduce((acc, f) => ({ ...acc, [f.clave]: coleccion.contar(f) }), {}),
      filtros: FILTROS.map(f => ({ clave: f.clave, etiqueta: f.etiqueta })),
      reservas,
    };
  }

  detalle(passengerId, reservaId) {
    const reserva = this.#obtener(passengerId, reservaId);
    const historial = this.invocador.listar(passengerId, reserva.id);
    return {
      ...this.#aVista(reserva, Date.now(), historial.some(h => !h.undone)),
      historialParticipacion: historial,
    };
  }

  // ───────────────────────────── US35 ─────────────────────────────

  confirmarParticipacion(passengerId, reservaId) {
    const reserva = this.#obtenerParaParticipacion(passengerId, reservaId);
    if (reserva.participation?.status === PARTICIPATION_STATUS.CONFIRMED) {
      throw new DomainError('Ya confirmaste tu participación en este viaje.', 409);
    }
    const comando = new ConfirmarParticipacionCommand(this.gestor, reserva);
    const actualizada = this.invocador.ejecutar(comando, passengerId);
    return this.#aVista(actualizada, Date.now(), true);
  }

  declinarParticipacion(passengerId, reservaId, motivo) {
    const reserva = this.#obtenerParaParticipacion(passengerId, reservaId);
    if (reserva.participation?.status === PARTICIPATION_STATUS.DECLINED) {
      throw new DomainError('Ya indicaste que no participarás en este viaje.', 409);
    }
    const comando = new DeclinarParticipacionCommand(this.gestor, reserva, motivo);
    const actualizada = this.invocador.ejecutar(comando, passengerId);
    return this.#aVista(actualizada, Date.now(), true);
  }

  deshacerParticipacion(passengerId, reservaId) {
    const reserva = this.#obtenerParaParticipacion(passengerId, reservaId);
    const resultado = this.invocador.deshacerUltimo(this.gestor, reserva, passengerId);
    if (!resultado) throw new DomainError('No hay ninguna acción para deshacer en esta reserva.', 409);

    const pendientes = this.invocador.listar(passengerId, reserva.id).some(h => !h.undone);
    return { reserva: this.#aVista(resultado.reserva, Date.now(), pendientes), deshecho: resultado.deshecho.descripcion };
  }

  // ─────────────────────────── Auxiliares ───────────────────────────

  #obtener(passengerId, reservaId) {
    const reserva = this.repositorio.buscarDelPasajero(passengerId, reservaId);
    if (!reserva) throw new DomainError('La reserva no existe.', 404);
    return reserva;
  }

  /** Reglas comunes de US35: solo reservas vigentes y antes de la salida. */
  #obtenerParaParticipacion(passengerId, reservaId) {
    const reserva = this.#obtener(passengerId, reservaId);
    const estado = estadoEfectivo(reserva);
    if (estado === RESERVATION_STATUS.CANCELLED) {
      throw new DomainError('La reserva fue cancelada; no es posible confirmar participación.', 409);
    }
    if (estado === RESERVATION_STATUS.COMPLETED) {
      throw new DomainError('El viaje ya salió; no es posible modificar tu participación.', 409);
    }
    return reserva;
  }

  #aVista(reserva, ahora, tieneDeshacer = false) {
    const estado = estadoEfectivo(reserva, ahora);
    const salida = horaDeSalida(reserva);
    const participacion = reserva.participation?.status || PARTICIPATION_STATUS.PENDING;
    const vigente = estado === RESERVATION_STATUS.CONFIRMED;

    return {
      id: reserva.id,
      routeId: reserva.routeId,
      driverId: reserva.driverId,
      driver: { name: reserva.driver?.name, vehicle: reserva.driver?.vehicle },
      route: reserva.route,
      seats: reserva.seats,
      price: reserva.price,
      createdAt: reserva.createdAt,
      fuente: reserva.fuente,
      cancelReason: reserva.cancelReason || null,
      estado: { codigo: estado, ...ETIQUETAS_RESERVA[estado] },
      participacion: {
        codigo: participacion,
        ...ETIQUETAS_PARTICIPACION[participacion],
        note: reserva.participation?.note || null,
        updatedAt: reserva.participation?.updatedAt || null,
      },
      minutosParaSalida: salida !== null ? Math.round((salida - ahora) / 60000) : null,
      requiereConfirmacion:
        vigente && participacion === PARTICIPATION_STATUS.PENDING && salida !== null && salida - ahora <= VENTANA_RECORDATORIO_MS,
      acciones: {
        puedeConfirmar: vigente && participacion !== PARTICIPATION_STATUS.CONFIRMED,
        puedeDeclinar: vigente && participacion !== PARTICIPATION_STATUS.DECLINED,
        puedeDeshacer: vigente && tieneDeshacer,
      },
    };
  }
}

module.exports = { ReservaService };
