// tripCatalog/tripCatalogService.js
// ─────────────────────────────────────────────────────────────
// Lógica de negocio del catálogo de viajes (US27 y US28).
// Capa de SERVICIO: no sabe de HTTP (eso es el controlador) ni de archivos
// (eso son los DAO y adapters). Todas sus dependencias llegan por el
// constructor (DIP) y se usan solo por su interfaz (duck typing):
//
//   fuente        -> { listar() }                  (RutaFuenteAdapter)
//   calificaciones-> { resumenDe(driverId) }       (CalificacionConductorAdapter, sobre US24)
//   visibilidad   -> { estaVisible(driverId) }     (AccountFacade, US32)
//   usuarios      -> { buscarPorId(id) }           (UsuarioRepositorioAdapter, opcional)
//   reloj         -> () => ms                      (inyectable en pruebas)
// ─────────────────────────────────────────────────────────────

const { FabricaOrdenamiento } = require('./tripSortStrategies');
const { construirFiltros } = require('./tripFilters');

const SIEMPRE_VISIBLE = { estaVisible: () => true };
const SIN_USUARIOS = { buscarPorId: () => null };

class CatalogoViajesService {
  constructor({ fuente, calificaciones, visibilidad = SIEMPRE_VISIBLE, usuarios = SIN_USUARIOS, reloj = Date.now }) {
    this.fuente = fuente;
    this.calificaciones = calificaciones;
    this.visibilidad = visibilidad;
    this.usuarios = usuarios;
    this.reloj = reloj;
  }

  /**
   * @param {{ orden?: string, tarifaMax?: string|number }} consulta
   */
  listar(consulta = {}) {
    const estrategia = FabricaOrdenamiento.crear(consulta.orden);
    const filtros = construirFiltros(consulta);
    const ahora = this.reloj();

    const candidatos = this.fuente.listar()
      .filter(viaje => this.#estaVigente(viaje, ahora))
      .filter(viaje => this.visibilidad.estaVisible(viaje.driverId))
      .filter(viaje => viaje.seats > 0 || estrategia.mostrarAgotados)
      .filter(viaje => filtros.every(filtro => filtro.acepta(viaje)));

    const ordenados = estrategia.ordenar(candidatos, { calificacionDe: this.#promedioDe() });

    return {
      orden: estrategia.clave,
      ordenes: FabricaOrdenamiento.opciones(),
      total: ordenados.length,
      generadoEn: new Date(ahora).toISOString(),
      viajes: ordenados.map(viaje => this.#aVista(viaje)),
    };
  }

  #estaVigente(viaje, ahora) {
    // Sin hora conocida se conserva (igual que hace /trips actualmente).
    return !Number.isFinite(viaje.salidaTimestamp) || viaje.salidaTimestamp > ahora;
  }

  /** Promedio del conductor (0 si no tiene calificaciones) con caché por consulta. */
  #promedioDe() {
    const cache = new Map();
    return driverId => {
      if (!cache.has(driverId)) {
        const { average } = this.#resumenDe(driverId);
        cache.set(driverId, Number.isFinite(average) ? average : 0);
      }
      return cache.get(driverId);
    };
  }

  #resumenDe(driverId) {
    return driverId ? this.calificaciones.resumenDe(driverId) : { average: null, count: 0 };
  }

  #aVista(viaje) {
    const agotado = viaje.seats <= 0;
    const conductor = viaje.driverId ? this.usuarios.buscarPorId(viaje.driverId) : null;
    return {
      ...viaje,
      agotado,
      etiqueta: agotado ? 'Agotado' : null,
      driverName: conductor ? `${conductor.firstName || ''} ${conductor.lastName || ''}`.trim() || null : null,
      driverRating: viaje.driverId ? this.#resumenDe(viaje.driverId) : null,
    };
  }
}

module.exports = { CatalogoViajesService };
