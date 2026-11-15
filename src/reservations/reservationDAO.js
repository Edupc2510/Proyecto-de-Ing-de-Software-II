// reservations/reservationDAO.js
// PATRÓN DAO: acceso a las reservas propias del módulo (data/reservations.json).

const { JsonDAO } = require('../shared/persistence/JsonDAO');

class ReservaDAO extends JsonDAO {
  constructor() {
    super('reservations.json');
  }

  listarPorPasajero(passengerId) {
    return this.buscar(r => String(r.passengerId) === String(passengerId));
  }

  buscarDelPasajero(passengerId, reservaId) {
    const reserva = this.buscarPorId(reservaId);
    return reserva && String(reserva.passengerId) === String(passengerId) ? reserva : null;
  }
}

module.exports = { ReservaDAO };
