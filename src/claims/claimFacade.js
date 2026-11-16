// claims/claimFacade.js
// ─────────────────────────────────────────────────────────────
// PATRÓN FACADE (Estructural) - US37 Consultar estado del reclamo
// ─────────────────────────────────────────────────────────────
// Problema: para mostrar el estado de un reclamo, el controlador tendría que
// hablar con el ReclamoDAO, con el repositorio de reservas (viaje asociado),
// con el catálogo de estados y con cada decorador de vista, y además saber en
// qué orden combinarlos.
//
// Solución: ReclamoFacade ofrece operaciones simples de alto nivel
// (consultarMisReclamos, consultarReclamo, registrarReclamo) y coordina
// internamente todos esos subsistemas. El controlador solo conoce la Facade.
//
//   Cliente      -> claimController
//   Facade       -> ReclamoFacade
//   Subsistemas  -> ReclamoDAO, GeneradorCodigoReclamo (Singleton),
//                   ReservaRepositorio, decoradores de vista, catálogo
// ─────────────────────────────────────────────────────────────

const { ReclamoDAO } = require('./claimDAO');
const { GeneradorCodigoReclamo } = require('./claimCodeGenerator');
const { CLAIM_STATUS, CATALOGO_ESTADOS, CATEGORIAS, crearReclamo } = require('./claimModel');
const {
  VistaReclamoBase,
  ConTiempoDeRespuesta,
  ConLineaDeTiempo,
  ConRespuestaSoporte,
  ConViajeAsociado,
} = require('./claimViewDecorators');
const { ReservaRepositorio } = require('../reservations/reservationRepository');
const { DomainError } = require('../shared/httpHelpers');

class ReclamoFacade {
  constructor({ reclamoDAO = new ReclamoDAO(), reservas = ReservaRepositorio.crearPorDefecto() } = {}) {
    this.reclamoDAO = reclamoDAO;
    this.reservas = reservas;
  }

  /**
   * Lista los reclamos del pasajero (vista base + tiempo de respuesta).
   */
  consultarMisReclamos(passengerId, { estado } = {}) {
    if (estado && estado !== 'todos' && !CATALOGO_ESTADOS[estado]) {
      throw new DomainError('El estado de filtro no es válido.');
    }
    const ahora = Date.now();
    const reclamos = this.reclamoDAO.listarPorPasajero(passengerId);

    const abiertos = reclamos.filter(r => !CATALOGO_ESTADOS[r.status]?.final).length;
    const filtrados = !estado || estado === 'todos' ? reclamos : reclamos.filter(r => r.status === estado);

    return {
      total: reclamos.length,
      abiertos,
      cerrados: reclamos.length - abiertos,
      estados: Object.entries(CATALOGO_ESTADOS).map(([codigo, e]) => ({ codigo, etiqueta: e.etiqueta })),
      reclamos: filtrados
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(r => new ConTiempoDeRespuesta(new VistaReclamoBase(r), r, ahora).construir()),
    };
  }

  /**
   * Detalle completo: la vista base se envuelve con todos los decoradores.
   * @param {string} codigo - código REC-AAAA-NNNNNN o id interno
   */
  consultarReclamo(passengerId, codigo) {
    const reclamo = this.reclamoDAO.buscarPorCodigoDelPasajero(passengerId, codigo);
    if (!reclamo) throw new DomainError('No encontramos un reclamo tuyo con ese código.', 404);

    let vista = new VistaReclamoBase(reclamo);
    vista = new ConTiempoDeRespuesta(vista, reclamo);
    vista = new ConLineaDeTiempo(vista, reclamo);
    vista = new ConRespuestaSoporte(vista, reclamo);
    vista = new ConViajeAsociado(vista, reclamo, id => this.reservas.buscarDelPasajero(passengerId, id));
    return vista.construir();
  }

  /**
   * Punto de integración para la HU de "registrar reclamo" de otro
   * integrante. Hoy lo usa el generador de datos de demostración.
   */
  registrarReclamo(passengerId, { reservationId = null, category, subject, description, demo = false }) {
    if (!String(subject || '').trim() || !String(description || '').trim()) {
      throw new DomainError('El asunto y la descripción del reclamo son obligatorios.');
    }
    if (!CATEGORIAS[category]) throw new DomainError('La categoría del reclamo no es válida.');

    const code = GeneradorCodigoReclamo.getInstancia().siguienteCodigo();
    const reclamo = crearReclamo({ code, passengerId, reservationId, category, subject, description, demo });
    this.reclamoDAO.guardar(reclamo);
    return reclamo;
  }

  /**
   * Cambia el estado de un reclamo (lo usará el módulo de soporte/admin).
   */
  actualizarEstado(reclamoId, nuevoEstado, { nota = null, agente, respuesta } = {}) {
    if (!Object.values(CLAIM_STATUS).includes(nuevoEstado)) throw new DomainError('Estado de reclamo no válido.');
    const reclamo = this.reclamoDAO.buscarPorId(reclamoId);
    if (!reclamo) throw new DomainError('El reclamo no existe.', 404);

    return this.reclamoDAO.actualizar(reclamoId, {
      status: nuevoEstado,
      assignedAgent: agente ?? reclamo.assignedAgent,
      response: respuesta ?? reclamo.response,
      history: [...(reclamo.history || []), { status: nuevoEstado, at: new Date().toISOString(), note: nota }],
    });
  }
}

module.exports = { ReclamoFacade };
