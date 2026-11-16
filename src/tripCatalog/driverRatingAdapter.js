// tripCatalog/driverRatingAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: para desempatar viajes con la misma hora (US27, escenario 03) el
// catálogo necesita la reputación del conductor. Esa información la produce la
// US24 (calificar conductor) en src/ratings/ratingModel.js mediante funciones
// sueltas (getDriverRatingSummary). El catálogo no debe depender de ese módulo
// ni de su formato (DIP).
//
// Solución: CalificacionConductorAdapter implementa la interfaz que el
// catálogo espera, resumenDe(driverId) -> { average, count }, y delega en el
// módulo de la US24 SIN modificarlo. Si la US24 cambia su almacenamiento, solo
// cambia este adaptador.
//
//   Cliente  -> CatalogoViajesService
//   Target   -> { resumenDe(driverId) }
//   Adapter  -> CalificacionConductorAdapter
//   Adaptee  -> src/ratings/ratingModel.js (US24)
// ─────────────────────────────────────────────────────────────

class CalificacionConductorAdapter {
  /**
   * @param {object} [ratingModel] - módulo ratings/ratingModel (inyectable en pruebas)
   */
  constructor(ratingModel = require('../ratings/ratingModel')) {
    this.ratingModel = ratingModel;
  }

  /** @returns {{ average: number|null, count: number }} */
  resumenDe(driverId) {
    return this.ratingModel.getDriverRatingSummary(driverId);
  }
}

module.exports = { CalificacionConductorAdapter };
