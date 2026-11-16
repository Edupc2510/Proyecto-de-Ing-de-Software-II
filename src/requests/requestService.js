// requests/requestService.js
// Lógica de negocio de US15 - Visualizar estado de solicitudes.
// Lee las solicitudes del modelo de la US14 (bookings) mediante el adapter
// y usa la fábrica de estados para la presentación.

const { BookingSolicitudAdapter } = require('./bookingRequestAdapter');
const { FabricaEstadoSolicitud } = require('./requestStatusFactory');
const { REQUEST_STATUS } = require('./requestModel');
const { DomainError } = require('../shared/httpHelpers');

class SolicitudService {
  /** @param {BookingSolicitudAdapter} fuente */
  constructor(fuente = BookingSolicitudAdapter.crearPorDefecto()) {
    this.fuente = fuente;
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

    const ahora = Date.now();
    const solicitudes = this.fuente.listarPorPasajero(passengerId).map(s => conExpiracion(s, ahora));

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
    const solicitud = this.fuente.buscarDelPasajero(passengerId, solicitudId);
    if (!solicitud) throw new DomainError('La solicitud no existe.', 404);
    return this.#aVista(conExpiracion(solicitud, Date.now()), { conHistorial: true });
  }

  cancelar(passengerId, solicitudId) {
    const solicitud = this.fuente.buscarDelPasajero(passengerId, solicitudId);
    if (!solicitud) throw new DomainError('La solicitud no existe.', 404);

    const estado = FabricaEstadoSolicitud.crearEstado(conExpiracion(solicitud, Date.now()).status);
    if (!estado.puedeCancelar()) {
      throw new DomainError(`No puedes cancelar una solicitud en estado "${estado.etiqueta}".`, 409);
    }

    const actualizada = this.fuente.cancelar(solicitud.id, 'Cancelada por el pasajero.');
    return this.#aVista(actualizada, { conHistorial: true });
  }

  #aVista(solicitud, { conHistorial = false } = {}) {
    const estado = FabricaEstadoSolicitud.crearEstado(solicitud.status);
    const vista = {
      id: solicitud.id,
      routeId: solicitud.routeId,
      driver: { name: solicitud.driver?.name },
      route: solicitud.route,
      seatsRequested: solicitud.seatsRequested,
      pickupAddress: solicitud.pickupAddress,
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

/**
 * Una solicitud pendiente cuyo viaje ya salió se muestra como "expirada".
 * Se calcula al leer, sin modificar bookings.json.
 */
function conExpiracion(solicitud, ahora) {
  const salida = solicitud.route?.departureAt ? new Date(solicitud.route.departureAt).getTime() : NaN;
  if (solicitud.status !== REQUEST_STATUS.PENDING || !Number.isFinite(salida) || salida > ahora) return solicitud;
  return {
    ...solicitud,
    status: REQUEST_STATUS.EXPIRED,
    history: [...(solicitud.history || []), { status: REQUEST_STATUS.EXPIRED, at: new Date(salida).toISOString(), note: 'El viaje salió sin respuesta del conductor.' }],
  };
}

module.exports = { SolicitudService };
