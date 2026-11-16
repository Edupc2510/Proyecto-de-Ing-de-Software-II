// ratings/passengerRatingDAO.js
// ─────────────────────────────────────────────────────────────
// PATRÓN DAO (Acceso a datos)
// El servicio nunca lee archivos: solo usa este DAO. Trabaja sobre el MISMO
// archivo data/ratings.json que la US24, pero solo ve las calificaciones con
// rateeRole 'passenger'; las de rol 'driver' quedan intactas.
// ─────────────────────────────────────────────────────────────

const { JsonDAO } = require('../shared/persistence/JsonDAO');
const { ROLE_PASSENGER } = require('./passengerRatingRecord');

class CalificacionPasajeroDAO extends JsonDAO {
  constructor() {
    super('ratings.json');
  }

  /** Calificación que el conductor ya dio a ese pasajero por ese viaje, o null (misma clave que la US24). */
  buscarDuplicada({ routeId, driverId, passengerId }) {
    return this.buscar(c =>
      c.rateeRole === ROLE_PASSENGER &&
      c.routeId === String(routeId) &&
      c.raterId === String(driverId) &&
      c.rateeId === String(passengerId)
    )[0] || null;
  }

  /** Calificaciones emitidas por el conductor, de la más reciente a la más antigua. */
  listarEmitidas(driverId) {
    return this.buscar(c => c.rateeRole === ROLE_PASSENGER && c.raterId === String(driverId))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}

module.exports = { CalificacionPasajeroDAO };
