// drivers/driverContactDAO.js
// PATRÓN DAO: registro de contactos/mensajes del pasajero hacia sus
// conductores frecuentes (data/driver_contacts.json). Sirve como historial
// y como trazabilidad de seguridad (quién contactó a quién y por qué canal).

const { v4: uuidv4 } = require('uuid');
const { JsonDAO } = require('../shared/persistence/JsonDAO');

class ContactoConductorDAO extends JsonDAO {
  constructor() {
    super('driver_contacts.json');
  }

  registrarContacto({ driverId, passengerId, canal, texto = null }) {
    return this.guardar({
      id: uuidv4(),
      driverId: String(driverId),
      passengerId: String(passengerId),
      canal,
      texto,
      createdAt: new Date().toISOString(),
    });
  }

  /** Usado por la estrategia de mensaje interno */
  registrarMensaje({ driverId, passengerId, texto }) {
    return this.registrarContacto({ driverId, passengerId, canal: 'mensaje', texto });
  }

  listarConversacion(passengerId, driverId) {
    return this.buscar(c => String(c.passengerId) === String(passengerId) && String(c.driverId) === String(driverId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = { ContactoConductorDAO };
