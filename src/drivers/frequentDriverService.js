// drivers/frequentDriverService.js
// Lógica de negocio de US30 - Contactar conductores frecuentes.
//
// Un conductor es "frecuente" para un pasajero cuando compartieron al menos
// MIN_VIAJES_FRECUENTE viajes completados. Por seguridad, solo se puede
// contactar a conductores con los que el pasajero ya viajó.

const { ReservaRepositorio } = require('../reservations/reservationRepository');
const { RESERVATION_STATUS, estadoEfectivo, horaDeSalida } = require('../reservations/reservationModel');
const { FabricaCanalContacto } = require('./contactChannels');
const { ContactoConductorDAO } = require('./driverContactDAO');
const { DomainError } = require('../shared/httpHelpers');

const MIN_VIAJES_FRECUENTE = 2;

class ConductorFrecuenteService {
  constructor({ repositorio = ReservaRepositorio.crearPorDefecto(), contactoDAO = new ContactoConductorDAO() } = {}) {
    this.repositorio = repositorio;
    this.contactoDAO = contactoDAO;
    this.fabricaCanales = new FabricaCanalContacto(contactoDAO);
  }

  listar(passengerId) {
    const frecuentes = this.#calcularFrecuentes(passengerId);
    const canales = this.fabricaCanales.crearTodos();

    return frecuentes.map(conductor => ({
      driverId: conductor.id,
      name: conductor.name,
      vehicle: conductor.vehicle,
      viajesCompartidos: conductor.viajes,
      ultimoViaje: conductor.ultimoViaje,
      rutaFrecuente: conductor.rutaFrecuente,
      canales: canales.map(c => ({ clave: c.clave, etiqueta: c.etiqueta, disponible: c.estaDisponible(conductor) })),
      ultimoContacto: this.contactoDAO.listarConversacion(passengerId, conductor.id)[0]?.createdAt || null,
    }));
  }

  contactar(pasajero, driverId, claveCanal, mensaje) {
    const conductor = this.#calcularFrecuentes(pasajero.id).find(c => String(c.id) === String(driverId));
    if (!conductor) {
      throw new DomainError('Solo puedes contactar a conductores con los que ya compartiste viajes frecuentes.', 403);
    }

    // Factory Method: obtenemos la estrategia concreta según el canal elegido
    const canal = this.fabricaCanales.crearCanal(claveCanal);
    if (!canal) throw new DomainError('El canal de contacto no es válido.');
    if (!canal.estaDisponible(conductor)) {
      throw new DomainError(`${conductor.name} no tiene disponible el canal "${canal.etiqueta}".`, 409);
    }

    let resultado;
    try {
      // Strategy: cada canal resuelve el contacto a su manera
      resultado = canal.contactar({ conductor, pasajero, mensaje });
    } catch (error) {
      if (error.validacion) throw new DomainError(error.message);
      throw error;
    }

    // El mensaje interno ya se registra en su estrategia; los demás se auditan aquí.
    if (canal.clave !== 'mensaje') {
      this.contactoDAO.registrarContacto({ driverId: conductor.id, passengerId: pasajero.id, canal: canal.clave, texto: resultado.mensaje });
    }

    return { canal: canal.clave, etiqueta: canal.etiqueta, ...resultado };
  }

  historial(passengerId, driverId) {
    const conductor = this.#calcularFrecuentes(passengerId).find(c => String(c.id) === String(driverId));
    if (!conductor) throw new DomainError('El conductor no está entre tus conductores frecuentes.', 404);
    return { driver: { driverId: conductor.id, name: conductor.name }, contactos: this.contactoDAO.listarConversacion(passengerId, driverId) };
  }

  /**
   * Agrupa los viajes completados del pasajero por conductor.
   */
  #calcularFrecuentes(passengerId) {
    const ahora = Date.now();
    const porConductor = new Map();

    this.repositorio.listarPorPasajero(passengerId)
      .filter(r => r.driverId && estadoEfectivo(r, ahora) === RESERVATION_STATUS.COMPLETED)
      .sort((a, b) => (horaDeSalida(b) || 0) - (horaDeSalida(a) || 0))
      .forEach(reserva => {
        const id = String(reserva.driverId);
        if (!porConductor.has(id)) {
          porConductor.set(id, { reservas: [], ultima: reserva });
        }
        porConductor.get(id).reservas.push(reserva);
      });

    return [...porConductor.entries()]
      .filter(([, info]) => info.reservas.length >= MIN_VIAJES_FRECUENTE)
      .map(([id, info]) => this.#perfilConductor(id, info))
      .sort((a, b) => b.viajes - a.viajes || new Date(b.ultimoViaje) - new Date(a.ultimoViaje));
  }

  #perfilConductor(id, { reservas, ultima }) {
    // Los datos del conductor ya vienen resueltos por el BookingAdapter
    // (usuario registrado o, en su defecto, la foto guardada en el booking).
    const rutas = new Map();
    reservas.forEach(r => {
      const clave = `${r.route.origin} → ${r.route.dest}`;
      rutas.set(clave, (rutas.get(clave) || 0) + 1);
    });
    const [rutaFrecuente] = [...rutas.entries()].sort((a, b) => b[1] - a[1])[0] || [null];

    return {
      id,
      name: ultima.driver?.name,
      phone: ultima.driver?.phone || null,
      email: ultima.driver?.email || null,
      vehicle: ultima.driver?.vehicle || null,
      viajes: reservas.length,
      ultimoViaje: ultima.route?.departureAt || ultima.createdAt,
      rutaFrecuente,
    };
  }
}

module.exports = { ConductorFrecuenteService, MIN_VIAJES_FRECUENTE };
