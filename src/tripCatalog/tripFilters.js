// tripCatalog/tripFilters.js
// ─────────────────────────────────────────────────────────────
// Filtros del catálogo (US27, escenario 04: ordenar combinado con filtros).
// Cada filtro es un objeto con acepta(viaje) (duck typing: el servicio solo
// necesita ese método). Para agregar un filtro nuevo basta con crear su
// clase y sumarlo en construirFiltros(): el servicio no cambia (OCP).
// ─────────────────────────────────────────────────────────────

const { parseRouteFilters, filterRoutes } = require('../trips/routeFilters');
const { DomainError } = require('../shared/httpHelpers');

class FiltroTarifaMaxima {
  constructor(maximo) {
    this.maximo = maximo;
  }

  /** Un viaje sin tarifa conocida no puede garantizar la condición del precio. */
  acepta(viaje) {
    return Number.isFinite(viaje.price) && viaje.price <= this.maximo;
  }
}

/**
 * Traduce los parámetros de la consulta en la lista de filtros activos.
 * @param {{ tarifaMax?: string|number }} consulta
 */
function construirFiltros(consulta = {}) {
  let routeFilters;
  try { routeFilters = parseRouteFilters(consulta); }
  catch (error) { throw new DomainError(error.message, 400); }
  // US26: reutiliza la misma validación y combina filtros antes de ordenar.
  const filtros = [{ acepta: viaje => filterRoutes([viaje], routeFilters).length > 0 }];
  const { tarifaMax } = consulta;

  if (tarifaMax !== undefined && tarifaMax !== null && tarifaMax !== '') {
    const maximo = Number(tarifaMax);
    if (!Number.isFinite(maximo) || maximo < 0) {
      throw new DomainError('La tarifa máxima debe ser un número mayor o igual a 0.', 400);
    }
    filtros.push(new FiltroTarifaMaxima(maximo));
  }
  return filtros;
}

module.exports = { FiltroTarifaMaxima, construirFiltros };
