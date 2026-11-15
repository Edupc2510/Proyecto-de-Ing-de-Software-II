// claims/claimDAO.js
// PATRÓN DAO: acceso a los reclamos (data/claims.json).

const { JsonDAO } = require('../shared/persistence/JsonDAO');

class ReclamoDAO extends JsonDAO {
  constructor() {
    super('claims.json');
  }

  listarPorPasajero(passengerId) {
    return this.buscar(r => String(r.passengerId) === String(passengerId));
  }

  buscarPorCodigoDelPasajero(passengerId, codigo) {
    const normalizado = String(codigo || '').trim().toUpperCase();
    return this.listar().find(r =>
      String(r.passengerId) === String(passengerId) && (r.code === normalizado || String(r.id) === String(codigo))
    ) || null;
  }

  codigosExistentes() {
    return this.listar().map(r => r.code).filter(Boolean);
  }
}

module.exports = { ReclamoDAO };
