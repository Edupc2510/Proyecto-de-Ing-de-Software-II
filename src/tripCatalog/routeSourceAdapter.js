// tripCatalog/routeSourceAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: las rutas publicadas viven en trips/routeModel.js (funciones
// getRoutes/saveRoutes con su propio formato: expiresAtTimestamp, seats,
// time "HH:mm"; sin tarifa ni calificación). El catálogo necesita "viajes"
// normalizados: marca de salida numérica, asientos numéricos y tarifa
// opcional, sin acoplarse al archivo ni al formato de ese módulo.
//
// Solución: RutaFuenteAdapter implementa la interfaz de fuente de viajes
// (listar()) y traduce el formato del Adaptee (routeModel) SIN modificarlo.
// Conserva todos los campos originales, así el frontend actual (que usa
// origin, dest, time, seats, originCoords...) sigue funcionando.
// Las rutas canceladas por el conductor (US34) nunca llegan al catálogo.
//
//   Cliente  -> CatalogoViajesService
//   Target   -> FuenteViajes { listar() }
//   Adapter  -> RutaFuenteAdapter
//   Adaptee  -> src/trips/routeModel.js
// ─────────────────────────────────────────────────────────────

/** Convierte "HH:mm" en la marca de tiempo de hoy a esa hora (o null). */
function marcaDesdeHora(hora, base = new Date()) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora || ''));
  if (!m) return null;
  const fecha = new Date(base);
  fecha.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return fecha.getTime();
}

function numeroOpcional(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

class RutaFuenteAdapter {
  /**
   * @param {object} [routeModel] - módulo trips/routeModel (inyectable en pruebas)
   */
  constructor(routeModel = require('../trips/routeModel')) {
    this.routeModel = routeModel;
  }

  listar() {
    return this.routeModel.getRoutes()
      .filter(ruta => !this.routeModel.isRouteCancelled(ruta))
      .map(ruta => this.#aViaje(ruta));
  }

  /** Traducción del formato del Adaptee al formato que espera el catálogo */
  #aViaje(ruta) {
    const asientos = Number(ruta.seats);
    return {
      ...ruta,
      seats: Number.isFinite(asientos) ? asientos : 0,
      salidaTimestamp: numeroOpcional(ruta.expiresAtTimestamp) ?? marcaDesdeHora(ruta.time),
      // Las rutas actuales no tienen tarifa: se lee si otra HU la agrega.
      price: numeroOpcional(ruta.price ?? ruta.fare ?? ruta.tarifa),
    };
  }
}

module.exports = { RutaFuenteAdapter, marcaDesdeHora };
