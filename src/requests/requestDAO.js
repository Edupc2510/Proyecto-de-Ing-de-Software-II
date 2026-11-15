// requests/requestDAO.js
// PATRÓN DAO: acceso a datos de las solicitudes de viaje (data/trip_requests.json).
// El servicio de solicitudes no conoce archivos ni JSON; solo usa estos métodos.

const { JsonDAO } = require('../shared/persistence/JsonDAO');

class SolicitudDAO extends JsonDAO {
  constructor() {
    super('trip_requests.json');
  }

  listarPorPasajero(passengerId) {
    return this.buscar(s => String(s.passengerId) === String(passengerId));
  }

  buscarDelPasajero(passengerId, solicitudId) {
    const solicitud = this.buscarPorId(solicitudId);
    return solicitud && String(solicitud.passengerId) === String(passengerId) ? solicitud : null;
  }
}

module.exports = { SolicitudDAO };
