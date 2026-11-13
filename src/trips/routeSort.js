
// Ordenamiento de viajes disponibles (US27 y US28).

const SORT_KEYS = {
  SOONEST: 'soonest',         // US27 - "Más próximos"
  LATEST: 'latest',           // US27 - "Más tarde"
  MOST_SEATS: 'most-seats',   // US28 - "Más asientos libres"
  LAST_SEATS: 'last-seats',   // US28 - "Últimos cupos"
};

const DEFAULT_SORT = SORT_KEYS.SOONEST;

const VALID_SORT_KEYS = Object.values(SORT_KEYS);

/**
 * Devuelve un criterio válido. Si llega algo desconocido o vacío,
 * se usa el criterio por defecto en lugar de fallar.
 */
function normalizeSortKey(value) {
  const key = String(value || '').trim().toLowerCase();
  return VALID_SORT_KEYS.includes(key) ? key : DEFAULT_SORT;
}

/**
 * Timestamp (ms) de la hora de salida de una ruta.
 * Usa expiresAtTimestamp (que es la hora de salida del día) y, si no existe,
 * interpreta el campo "time" (HH:mm) como una hora de hoy.
 * Si no se puede determinar, devuelve Infinity para que quede al final.
 */
function getDepartureTimestamp(route) {
  const stamp = Number(route?.expiresAtTimestamp);
  if (Number.isFinite(stamp) && stamp > 0) return stamp;

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(route?.time || ''));
  if (!match) return Infinity;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.getTime();
}

const getSeats = (route) => {
  const seats = Number(route?.seats);
  return Number.isFinite(seats) && seats > 0 ? seats : 0;
};

// Calificación del conductor. Todavía no existe en el modelo de rutas
// (llegará con US24/US25); mientras tanto vale 0 y no altera el orden.
const getDriverRating = (route) => {
  const rating = Number(route?.driverRating);
  return Number.isFinite(rating) ? rating : 0;
};

const isSoldOut = (route) => getSeats(route) === 0;

// Comparadores base (cada uno devuelve <0, 0 o >0)
const byDepartureAsc = (a, b) => getDepartureTimestamp(a) - getDepartureTimestamp(b);
const byDepartureDesc = (a, b) => getDepartureTimestamp(b) - getDepartureTimestamp(a);
const byRatingDesc = (a, b) => getDriverRating(b) - getDriverRating(a);
const bySeatsDesc = (a, b) => getSeats(b) - getSeats(a);
const byCreatedAtAsc = (a, b) =>
  String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));

/**
 * Encadena comparadores: usa el siguiente solo si el anterior empata.
 */
const chain = (...comparators) => (a, b) => {
  for (const compare of comparators) {
    const result = compare(a, b);
    if (result !== 0 && !Number.isNaN(result)) return result;
  }
  return 0;
};

// "Últimos cupos": primero los que tienen exactamente 1 asiento, luego los
// que tienen menos disponibilidad primero (2, 3, 4...).
const byLastSeatsFirst = (a, b) => {
  const aOne = getSeats(a) === 1 ? 0 : 1;
  const bOne = getSeats(b) === 1 ? 0 : 1;
  if (aOne !== bOne) return aOne - bOne;
  return getSeats(a) - getSeats(b);
};

const COMPARATORS = {
  // más cercano a la hora actual; empate -> calificación
  [SORT_KEYS.SOONEST]: chain(byDepartureAsc, byRatingDesc, bySeatsDesc, byCreatedAtAsc),
  // la lista se invierte (salidas más tarde primero)
  [SORT_KEYS.LATEST]: chain(byDepartureDesc, byRatingDesc, bySeatsDesc, byCreatedAtAsc),
  // más cupos primero; empate -> horario más próximo
  [SORT_KEYS.MOST_SEATS]: chain(bySeatsDesc, byDepartureAsc, byRatingDesc, byCreatedAtAsc),
  // exactamente 1 asiento primero; empate -> horario más próximo
  [SORT_KEYS.LAST_SEATS]: chain(byLastSeatsFirst, byDepartureAsc, byRatingDesc, byCreatedAtAsc),
};

/**
 * Devuelve una COPIA ordenada del arreglo de rutas (no modifica el original).
 * Las rutas agotadas (0 asientos) siempre quedan al final, con cualquier criterio
 * y entre ellas se mantiene el orden por horario.
 *
 * Esta función solo ordena: si hay filtros (US26) deben aplicarse antes de
 * llamarla, así el orden se aplica únicamente al subconjunto filtrado.
 *
 * @param {Array} routes
 * @param {string} sortKey - uno de SORT_KEYS
 * @returns {Array}
 */
function sortRoutes(routes, sortKey) {
  const list = Array.isArray(routes) ? [...routes] : [];
  const compare = COMPARATORS[normalizeSortKey(sortKey)];

  const available = list.filter(route => !isSoldOut(route)).sort(compare);
  const soldOut = list
    .filter(isSoldOut)
    .sort(chain(byDepartureAsc, byCreatedAtAsc));

  return [...available, ...soldOut];
}

module.exports = {
  SORT_KEYS,
  DEFAULT_SORT,
  normalizeSortKey,
  getDepartureTimestamp,
  sortRoutes,
};
