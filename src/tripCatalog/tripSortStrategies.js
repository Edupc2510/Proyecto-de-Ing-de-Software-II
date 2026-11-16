// tripCatalog/tripSortStrategies.js
// ─────────────────────────────────────────────────────────────
// PATRÓN STRATEGY (Comportamiento) + FACTORY METHOD (Creacional)
// ─────────────────────────────────────────────────────────────
// Problema (US27 y US28): el pasajero puede ordenar los viajes por "más
// próximos", "más tarde", "más asientos libres" o "últimos cupos", y cada
// criterio tiene su propio desempate. Con un if/switch en el servicio, cada
// criterio nuevo obligaría a modificar el servicio (viola OCP) y el servicio
// mezclaría la lógica de todos los criterios (viola SRP).
//
// Solución:
//   Strategy        -> OrdenamientoViajes define el contrato comparar(a, b, ctx);
//                      cada criterio es una clase concreta intercambiable.
//   Factory Method  -> FabricaOrdenamiento.crear(clave) decide qué estrategia
//                      instanciar a partir del texto que llega por HTTP y
//                      valida que la clave exista. Agregar un criterio = crear
//                      la clase y registrarla; el servicio no cambia.
//
// Desempates (criterio secundario) por composición de comparadores:
//   - por horario  -> mejor calificación del conductor (US27 esc. 03)
//   - por asientos -> salida más próxima (US28 esc. 05)
// ─────────────────────────────────────────────────────────────

const { DomainError } = require('../shared/httpHelpers');

const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Los viajes sin hora conocida se van al final en orden ascendente. */
const salidaOInfinito = viaje => (Number.isFinite(viaje.salidaTimestamp) ? viaje.salidaTimestamp : Infinity);

/** Combina comparadores: usa el siguiente solo si el anterior empata (DRY). */
const encadenar = (...comparadores) => (a, b, ctx) => {
  for (const cmp of comparadores) {
    const resultado = cmp(a, b, ctx);
    if (resultado !== 0) return resultado;
  }
  return 0;
};

// Comparadores reutilizables
const porSalidaAscendente = (a, b) => comparar(salidaOInfinito(a), salidaOInfinito(b));
const porSalidaDescendente = (a, b) => comparar(salidaOInfinito(b), salidaOInfinito(a));
const porMejorCalificacion = (a, b, ctx) => comparar(ctx.calificacionDe(b.driverId), ctx.calificacionDe(a.driverId));
const agotadosAlFinal = (a, b) => comparar(a.seats <= 0 ? 1 : 0, b.seats <= 0 ? 1 : 0);
const porMasAsientos = (a, b) => comparar(b.seats, a.seats);
const porMenosAsientos = (a, b) => comparar(a.seats, b.seats);
const porId = (a, b) => comparar(String(a.id), String(b.id)); // orden estable

/** Contrato de la estrategia (Strategy). */
class OrdenamientoViajes {
  get clave() { throw new Error('Implementar en la estrategia concreta'); }
  get etiqueta() { throw new Error('Implementar en la estrategia concreta'); }
  /** ¿Este criterio muestra también los viajes sin asientos (con etiqueta "Agotado")? */
  get mostrarAgotados() { return false; }
  /** Comparador (a, b, ctx) -> -1 | 0 | 1. ctx = { calificacionDe(driverId) } */
  get comparador() { throw new Error('Implementar en la estrategia concreta'); }

  /** Devuelve una copia ordenada; no modifica el arreglo recibido. */
  ordenar(viajes, ctx) {
    const cmp = this.comparador;
    return [...viajes].sort((a, b) => cmp(a, b, ctx));
  }
}

class MasProximos extends OrdenamientoViajes {
  get clave() { return 'masProximos'; }
  get etiqueta() { return 'Más próximos'; }
  get comparador() { return encadenar(porSalidaAscendente, porMejorCalificacion, porId); }
}

class MasTarde extends OrdenamientoViajes {
  get clave() { return 'masTarde'; }
  get etiqueta() { return 'Más tarde'; }
  get comparador() { return encadenar(porSalidaDescendente, porMejorCalificacion, porId); }
}

class MasAsientosLibres extends OrdenamientoViajes {
  get clave() { return 'masAsientos'; }
  get etiqueta() { return 'Más asientos libres'; }
  get mostrarAgotados() { return true; }
  get comparador() { return encadenar(agotadosAlFinal, porMasAsientos, porSalidaAscendente, porId); }
}

class UltimosCupos extends OrdenamientoViajes {
  get clave() { return 'ultimosCupos'; }
  get etiqueta() { return 'Últimos cupos'; }
  get mostrarAgotados() { return true; }
  get comparador() { return encadenar(agotadosAlFinal, porMenosAsientos, porSalidaAscendente, porId); }
}

/** Creador (Factory Method): registro clave -> clase concreta. */
class FabricaOrdenamiento {
  static #registro = new Map(
    [MasProximos, MasTarde, MasAsientosLibres, UltimosCupos].map(Clase => [new Clase().clave, Clase])
  );

  static CLAVE_POR_DEFECTO = 'masProximos';

  /** @returns {OrdenamientoViajes} */
  static crear(clave) {
    const buscada = clave === undefined || clave === null || clave === '' ? FabricaOrdenamiento.CLAVE_POR_DEFECTO : String(clave);
    const Clase = FabricaOrdenamiento.#registro.get(buscada);
    if (!Clase) {
      throw new DomainError('El criterio de ordenamiento no es válido.', 400);
    }
    return new Clase();
  }

  /** Opciones para el selector del frontend: [{ clave, etiqueta }] */
  static opciones() {
    return [...FabricaOrdenamiento.#registro.values()].map(Clase => {
      const estrategia = new Clase();
      return { clave: estrategia.clave, etiqueta: estrategia.etiqueta };
    });
  }
}

module.exports = { OrdenamientoViajes, MasProximos, MasTarde, MasAsientosLibres, UltimosCupos, FabricaOrdenamiento };
