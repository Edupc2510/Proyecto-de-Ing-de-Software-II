// requests/requestService.js
// Lógica de negocio de US15 - Visualizar estado de solicitudes.
// Usa el DAO para los datos y la fábrica de estados para la presentación.

const { SolicitudDAO } = require('./requestDAO');
const { FabricaEstadoSolicitud } = require('./requestStatusFactory');
const { REQUEST_STATUS, transicion } = require('./requestModel');
const { DomainError } = require('../shared/httpHelpers');

class SolicitudService {
  constructor(solicitudDAO = new SolicitudDAO()) {
    this.dao = solicitudDAO;
  }

  /**
   * Lista las solicitudes del pasajero con su estado actualizado.
   * @param {string} passengerId
   * @param {{ estado?: string }} filtros
   */
  listar(passengerId, { estado } = {}) {
    if (estado && estado !== 'todas' && !FabricaEstadoSolicitud.codigosValidos().includes(estado)) {
      throw new DomainError('El estado de filtro no es válido.');
    }

    const solicitudes = this.#actualizarExpiradas(this.dao.listarPorPasajero(passengerId));

    const resumen = FabricaEstadoSolicitud.codigosValidos().reduce((acc, codigo) => ({ ...acc, [codigo]: 0 }), {});
    solicitudes.forEach(s => { resumen[s.status] = (resumen[s.status] || 0) + 1; });

    const filtradas = !estado || estado === 'todas' ? solicitudes : solicitudes.filter(s => s.status === estado);

    return {
      total: solicitudes.length,
      resumen,
      solicitudes: filtradas
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(s => this.#aVista(s)),
    };
  }

  detalle(passengerId, solicitudId) {
    const solicitud = this.dao.buscarDelPasajero(passengerId, solicitudId);
    if (!solicitud) throw new DomainError('La solicitud no existe.', 404);
    const [actualizada] = this.#actualizarExpiradas([solicitud]);
    return this.#aVista(actualizada, { conHistorial: true });
  }

  cancelar(passengerId, solicitudId) {
    const solicitud = this.dao.buscarDelPasajero(passengerId, solicitudId);
    if (!solicitud) throw new DomainError('La solicitud no existe.', 404);

    const estado = FabricaEstadoSolicitud.crearEstado(solicitud.status);
    if (!estado.puedeCancelar()) {
      throw new DomainError(`No puedes cancelar una solicitud en estado "${estado.etiqueta}".`, 409);
    }

    const actualizada = this.dao.actualizar(
      solicitud.id,
      transicion(solicitud, REQUEST_STATUS.CANCELLED, 'Cancelada por el pasajero.')
    );
    return this.#aVista(actualizada, { conHistorial: true });
  }

  /**
   * Una solicitud pendiente cuyo viaje ya salió pasa a "expirada".
   */
  #actualizarExpiradas(solicitudes) {
    const ahora = Date.now();
    return solicitudes.map(s => {
      const salida = s.route?.departureAt ? new Date(s.route.departureAt).getTime() : NaN;
      if (s.status === REQUEST_STATUS.PENDING && Number.isFinite(salida) && salida <= ahora) {
        return this.dao.actualizar(s.id, transicion(s, REQUEST_STATUS.EXPIRED, 'El viaje salió sin respuesta del conductor.'));
      }
      return s;
    });
  }

  #aVista(solicitud, { conHistorial = false } = {}) {
    const estado = FabricaEstadoSolicitud.crearEstado(solicitud.status);
    const vista = {
      id: solicitud.id,
      routeId: solicitud.routeId,
      driver: { name: solicitud.driver?.name },
      route: solicitud.route,
      seatsRequested: solicitud.seatsRequested,
      message: solicitud.message,
      createdAt: solicitud.createdAt,
      updatedAt: solicitud.updatedAt,
      estado: estado.toJSON(),
      descripcion: estado.descripcion(solicitud),
    };
    if (conHistorial) {
      vista.historial = (solicitud.history || []).map(h => ({
        ...h,
        etiqueta: FabricaEstadoSolicitud.crearEstado(h.status).etiqueta,
      }));
    }
    return vista;
  }
}

module.exports = { SolicitudService };
