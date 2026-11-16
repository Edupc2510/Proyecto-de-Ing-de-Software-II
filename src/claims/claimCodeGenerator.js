// claims/claimCodeGenerator.js
// ─────────────────────────────────────────────────────────────
// PATRÓN SINGLETON (Creacional)
// ─────────────────────────────────────────────────────────────
// Problema: cada reclamo necesita un código único y legible que el pasajero
// usa para consultar su estado (ej. REC-2026-000004). Si cada parte del
// sistema creara su propio generador, dos reclamos podrían recibir el mismo
// número (es el mismo caso del GeneradorNumeroComprobante visto en clase).
//
// Solución: una única instancia del generador, con constructor protegido y
// acceso mediante getInstancia(). Al crearse, toma como punto de partida el
// mayor correlativo ya guardado para no repetir códigos tras reiniciar.
// ─────────────────────────────────────────────────────────────

const { ReclamoDAO } = require('./claimDAO');

class GeneradorCodigoReclamo {
  static #instanciaUnica = null;
  static #creando = false;

  constructor(reclamoDAO) {
    if (!GeneradorCodigoReclamo.#creando) {
      throw new Error('GeneradorCodigoReclamo es un Singleton. Usa GeneradorCodigoReclamo.getInstancia().');
    }
    this.ultimoPorAnio = new Map();
    reclamoDAO.codigosExistentes().forEach(codigo => {
      const match = /^REC-(\d{4})-(\d+)$/.exec(codigo);
      if (match) {
        const anio = Number(match[1]);
        this.ultimoPorAnio.set(anio, Math.max(this.ultimoPorAnio.get(anio) || 0, Number(match[2])));
      }
    });
  }

  static getInstancia() {
    if (!GeneradorCodigoReclamo.#instanciaUnica) {
      GeneradorCodigoReclamo.#creando = true;
      try {
        GeneradorCodigoReclamo.#instanciaUnica = new GeneradorCodigoReclamo(new ReclamoDAO());
      } finally {
        GeneradorCodigoReclamo.#creando = false;
      }
    }
    return GeneradorCodigoReclamo.#instanciaUnica;
  }

  /** @returns {string} código correlativo, ej. REC-2026-000001 */
  siguienteCodigo(fecha = new Date()) {
    const anio = fecha.getFullYear();
    const siguiente = (this.ultimoPorAnio.get(anio) || 0) + 1;
    this.ultimoPorAnio.set(anio, siguiente);
    return `REC-${anio}-${String(siguiente).padStart(6, '0')}`;
  }
}

module.exports = { GeneradorCodigoReclamo };
