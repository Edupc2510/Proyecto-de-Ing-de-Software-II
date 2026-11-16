// reservations/participationCommands.js
// ─────────────────────────────────────────────────────────────
// PATRÓN COMMAND (Comportamiento) - US35 Confirmar participación en el viaje
// ─────────────────────────────────────────────────────────────
// Problema: el pasajero puede CONFIRMAR que asistirá a un viaje reservado o
// DECLINAR su participación, y puede DESHACER su última decisión mientras
// el viaje no haya salido. Además, por seguridad, queremos un historial
// (auditoría) de quién confirmó/declinó y cuándo.
//
// Solución: cada acción es un objeto comando con ejecutar() y deshacer().
//   Client           -> ReservaService (arma el comando con su receptor)
//   Invoker          -> InvocadorParticipacion (ejecuta, guarda historial, deshace)
//   Command          -> ComandoParticipacion
//   ConcreteCommand  -> ConfirmarParticipacionCommand, DeclinarParticipacionCommand
//   Receiver         -> GestorParticipacion (sabe cambiar la participación)
// El historial se persiste con un DAO, por lo que "deshacer" funciona aunque
// el pasajero recargue la página.
// ─────────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');
const { JsonDAO } = require('../shared/persistence/JsonDAO');
const { PARTICIPATION_STATUS } = require('./reservationModel');

/** Receiver: realiza la acción real sobre la reserva */
class GestorParticipacion {
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  cambiarParticipacion(reserva, nuevoEstado, nota = null) {
    return this.repositorio.actualizar(reserva, {
      participation: { status: nuevoEstado, updatedAt: new Date().toISOString(), note: nota },
    });
  }

  restaurar(reserva, participacionPrevia) {
    return this.repositorio.actualizar(reserva, { participation: participacionPrevia });
  }
}

/** Command (interfaz común) */
class ComandoParticipacion {
  constructor(gestor, reserva) {
    this.gestor = gestor;
    this.reserva = reserva;
    this.participacionPrevia = reserva.participation ? { ...reserva.participation } : null;
  }

  get tipo() { throw new Error('Implementar'); }
  get descripcion() { throw new Error('Implementar'); }
  ejecutar() { throw new Error('Implementar'); }

  deshacer() {
    return this.gestor.restaurar(this.reserva, this.participacionPrevia);
  }
}

class ConfirmarParticipacionCommand extends ComandoParticipacion {
  get tipo() { return 'confirmar'; }
  get descripcion() { return 'Confirmó su participación en el viaje'; }
  ejecutar() {
    return this.gestor.cambiarParticipacion(this.reserva, PARTICIPATION_STATUS.CONFIRMED, 'Asistencia confirmada por el pasajero.');
  }
}

class DeclinarParticipacionCommand extends ComandoParticipacion {
  constructor(gestor, reserva, motivo) {
    super(gestor, reserva);
    this.motivo = motivo ? String(motivo).trim().slice(0, 200) : null;
  }
  get tipo() { return 'declinar'; }
  get descripcion() { return 'Indicó que no participará en el viaje'; }
  ejecutar() {
    return this.gestor.cambiarParticipacion(this.reserva, PARTICIPATION_STATUS.DECLINED, this.motivo || 'El pasajero no podrá asistir.');
  }
}

/** DAO del historial de comandos (data/participation_log.json) */
class HistorialParticipacionDAO extends JsonDAO {
  constructor() {
    super('participation_log.json');
  }

  listarDeReserva(passengerId, reservaId) {
    return this.buscar(r => String(r.passengerId) === String(passengerId) && String(r.reservationId) === String(reservaId))
      .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
  }
}

/** Invoker: dispara los comandos sin conocer su lógica interna */
class InvocadorParticipacion {
  constructor(historialDAO = new HistorialParticipacionDAO()) {
    this.historial = historialDAO;
  }

  ejecutar(comando, passengerId) {
    const resultado = comando.ejecutar();
    this.historial.guardar({
      id: uuidv4(),
      reservationId: comando.reserva.id,
      passengerId: String(passengerId),
      tipo: comando.tipo,
      descripcion: comando.descripcion,
      previous: comando.participacionPrevia,
      executedAt: new Date().toISOString(),
      undone: false,
    });
    return resultado;
  }

  /**
   * Deshace el último comando vigente de una reserva. Reconstruye el comando a
   * partir del historial y llama a su método deshacer().
   */
  deshacerUltimo(gestor, reserva, passengerId) {
    const ultimo = this.historial.listarDeReserva(passengerId, reserva.id).find(r => !r.undone);
    if (!ultimo) return null;

    const comando = InvocadorParticipacion.#reconstruir(ultimo, gestor, reserva);
    const resultado = comando.deshacer();
    this.historial.actualizar(ultimo.id, { undone: true, undoneAt: new Date().toISOString() });
    return { reserva: resultado, deshecho: ultimo };
  }

  listar(passengerId, reservaId) {
    return this.historial.listarDeReserva(passengerId, reservaId);
  }

  static #reconstruir(registro, gestor, reserva) {
    const Clase = registro.tipo === 'declinar' ? DeclinarParticipacionCommand : ConfirmarParticipacionCommand;
    const comando = new Clase(gestor, reserva);
    comando.participacionPrevia = registro.previous;
    return comando;
  }
}

module.exports = {
  GestorParticipacion,
  ComandoParticipacion,
  ConfirmarParticipacionCommand,
  DeclinarParticipacionCommand,
  InvocadorParticipacion,
  HistorialParticipacionDAO,
};
