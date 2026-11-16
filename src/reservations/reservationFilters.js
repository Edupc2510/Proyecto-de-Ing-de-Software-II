// reservations/reservationFilters.js
// ─────────────────────────────────────────────────────────────
// PATRÓN STRATEGY (Comportamiento)
// ─────────────────────────────────────────────────────────────
// Problema: "Mis reservas" se puede ver como Próximas, Historial (pasadas),
// Canceladas o Todas. Cada vista tiene su propia regla para decidir qué
// reservas incluir y en qué orden mostrarlas. Meter todo eso en el servicio
// con if/switch lo vuelve difícil de mantener.
//
// Solución: cada criterio es una estrategia intercambiable con la misma
// interfaz (incluye() + comparar()). El iterador de reservas (Context) recibe
// la estrategia y la usa sin conocer cuál es. Agregar una vista nueva (ej.
// "Esta semana") solo requiere una nueva clase.
// ─────────────────────────────────────────────────────────────

const { RESERVATION_STATUS, horaDeSalida, estadoEfectivo } = require('./reservationModel');

/** Strategy (interfaz común) */
class FiltroReserva {
  get clave() { throw new Error('Implementar'); }
  get etiqueta() { throw new Error('Implementar'); }
  // eslint-disable-next-line no-unused-vars
  incluye(reserva, ahora) { throw new Error('Implementar'); }
  /** Orden por defecto: más reciente primero */
  comparar(a, b) {
    return (horaDeSalida(b) || 0) - (horaDeSalida(a) || 0);
  }
}

class FiltroProximas extends FiltroReserva {
  get clave() { return 'proximas'; }
  get etiqueta() { return 'Próximas'; }
  incluye(reserva, ahora) { return estadoEfectivo(reserva, ahora) === RESERVATION_STATUS.CONFIRMED; }
  /** Las próximas se ordenan de la más cercana a la más lejana */
  comparar(a, b) { return (horaDeSalida(a) || Infinity) - (horaDeSalida(b) || Infinity); }
}

class FiltroPasadas extends FiltroReserva {
  get clave() { return 'pasadas'; }
  get etiqueta() { return 'Historial'; }
  incluye(reserva, ahora) { return estadoEfectivo(reserva, ahora) === RESERVATION_STATUS.COMPLETED; }
}

class FiltroCanceladas extends FiltroReserva {
  get clave() { return 'canceladas'; }
  get etiqueta() { return 'Canceladas'; }
  incluye(reserva) { return reserva.status === RESERVATION_STATUS.CANCELLED; }
}

class FiltroTodas extends FiltroReserva {
  get clave() { return 'todas'; }
  get etiqueta() { return 'Todas'; }
  incluye() { return true; }
}

const FILTROS = [new FiltroProximas(), new FiltroPasadas(), new FiltroCanceladas(), new FiltroTodas()];

/**
 * Devuelve la estrategia según la clave recibida desde el frontend.
 * @param {string} clave
 * @returns {FiltroReserva|null}
 */
function obtenerFiltro(clave = 'proximas') {
  return FILTROS.find(f => f.clave === clave) || null;
}

module.exports = { FiltroReserva, FILTROS, obtenerFiltro };
