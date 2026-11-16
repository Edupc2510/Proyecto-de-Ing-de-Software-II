// notifications/matchCriteria.js
// ─────────────────────────────────────────────────────────────
// PATRÓN STRATEGY (comportamiento) – US31
// ─────────────────────────────────────────────────────────────
// Decidir si una ruta publicada "coincide" con la ruta habitual de un pasajero
// depende de varias reglas. Antes eran una cadena de if dentro de una sola
// función. Ahora cada regla es una estrategia con la misma interfaz:
//
//   cumple(route, alert) → boolean
//
// routeMatchingService recibe una lista de criterios y exige que se cumplan
// todos. Para agregar una regla nueva (por ejemplo, tarifa máxima) se crea otra
// clase y se suma a la lista, sin tocar las demás ni el servicio (abierto/cerrado).
// También permite usar listas distintas: las pruebas usan solo los criterios
// base y la app agrega la preferencia de cuenta de la US32.
// ─────────────────────────────────────────────────────────────

// Distancia máxima (km) entre origen/destino de la alerta y de la ruta
const MATCH_RADIUS_KM = 2;

/** Distancia en km entre dos coordenadas [lat, lng] (fórmula de Haversine). */
function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

/**
 * Indica si la hora de la ruta cae dentro del rango de la alerta.
 * Si la alerta no tiene rango horario, cualquier hora coincide.
 */
function isTimeInRange(routeTime, timeFrom, timeTo) {
  if (!timeFrom || !timeTo) return true;

  const t = toMinutes(routeTime);
  const from = toMinutes(timeFrom);
  const to = toMinutes(timeTo);

  // Rango normal (07:00 - 09:00) o rango que cruza medianoche (22:00 - 01:00)
  return from <= to ? t >= from && t <= to : t >= from || t <= to;
}

const hasValidCoords = (coords) =>
  Array.isArray(coords) &&
  coords.length === 2 &&
  Number.isFinite(Number(coords[0])) &&
  Number.isFinite(Number(coords[1]));

// ── Estrategia base (interfaz) ──
class CriterioCoincidencia {
  constructor(nombre) {
    if (new.target === CriterioCoincidencia) {
      throw new Error('CriterioCoincidencia es abstracto: crea un criterio concreto.');
    }
    this.nombre = nombre;
  }

  // eslint-disable-next-line no-unused-vars
  cumple(route, alert) {
    throw new Error(`El criterio "${this.nombre}" debe implementar cumple().`);
  }
}

// ── Estrategias concretas ──

/** Escenario 05: el pasajero desmarcó "Recibir alertas". */
class CriterioAlertaActiva extends CriterioCoincidencia {
  constructor() { super('alerta activa'); }
  cumple(route, alert) { return alert.active !== false; }
}

/** El conductor no recibe alertas por su propia ruta. */
class CriterioNoEsPropiaRuta extends CriterioCoincidencia {
  constructor() { super('no es su propia ruta'); }
  cumple(route, alert) {
    return !(route.driverId && String(route.driverId) === String(alert.userId));
  }
}

/** Ambas rutas deben tener coordenadas válidas para poder comparar. */
class CriterioCoordenadasValidas extends CriterioCoincidencia {
  constructor() { super('coordenadas válidas'); }
  cumple(route, alert) {
    return hasValidCoords(route.originCoords) && hasValidCoords(route.destCoords) &&
      hasValidCoords(alert.originCoords) && hasValidCoords(alert.destCoords);
  }
}

/** Escenario 01: origen (o destino) a una distancia máxima. */
class CriterioDistancia extends CriterioCoincidencia {
  /**
   * @param {'originCoords'|'destCoords'} campo
   * @param {number} radioKm
   */
  constructor(campo, radioKm = MATCH_RADIUS_KM) {
    super(`${campo === 'originCoords' ? 'origen' : 'destino'} a ≤ ${radioKm} km`);
    this.campo = campo;
    this.radioKm = radioKm;
  }

  cumple(route, alert) {
    return distanceKm(route[this.campo].map(Number), alert[this.campo].map(Number)) <= this.radioKm;
  }
}

/** Escenario 02: la hora de salida debe caer en el horario de la ruta habitual. */
class CriterioHorario extends CriterioCoincidencia {
  constructor() { super('dentro del horario'); }
  cumple(route, alert) { return isTimeInRange(route.time, alert.timeFrom, alert.timeTo); }
}

/** US32 (Fabrizio): el usuario puede apagar las alertas de nuevos viajes en su cuenta. */
class CriterioPreferenciaCuenta extends CriterioCoincidencia {
  /** @param {(userId: string) => boolean} puedeNotificar */
  constructor(puedeNotificar) {
    super('preferencia de la cuenta');
    this.puedeNotificar = puedeNotificar;
  }

  cumple(route, alert) { return this.puedeNotificar(alert.userId); }
}

/**
 * Criterios de la US31, ordenados de más barato a más costoso de evaluar
 * (las coordenadas se validan antes de calcular distancias).
 */
function crearCriteriosBase() {
  return [
    new CriterioAlertaActiva(),
    new CriterioNoEsPropiaRuta(),
    new CriterioCoordenadasValidas(),
    new CriterioDistancia('originCoords'),
    new CriterioDistancia('destCoords'),
    new CriterioHorario(),
  ];
}

module.exports = {
  MATCH_RADIUS_KM,
  distanceKm,
  isTimeInRange,
  CriterioCoincidencia,
  CriterioAlertaActiva,
  CriterioNoEsPropiaRuta,
  CriterioCoordenadasValidas,
  CriterioDistancia,
  CriterioHorario,
  CriterioPreferenciaCuenta,
  crearCriteriosBase,
};
