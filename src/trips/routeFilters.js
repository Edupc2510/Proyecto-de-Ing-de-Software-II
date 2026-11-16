const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// US26: normaliza solo nuestros filtros; deja intacto `sort` de US27/US28.
function parseRouteFilters(query = {}) {
  const timeFrom = query.timeFrom ?? '';
  const timeTo = query.timeTo ?? '';
  const minSeats = query.minSeats ?? '';
  if (typeof timeFrom !== 'string' || (timeFrom !== '' && !TIME.test(timeFrom))) {
    throw new Error('La hora inicial debe tener formato HH:mm.');
  }
  if (typeof timeTo !== 'string' || (timeTo !== '' && !TIME.test(timeTo))) {
    throw new Error('La hora final debe tener formato HH:mm.');
  }
  if (timeFrom && timeTo && timeFrom > timeTo) {
    throw new Error('La hora inicial no puede ser posterior a la final.');
  }
  if (typeof minSeats !== 'string' || !/^[1-4]?$/.test(minSeats)) {
    throw new Error('Selecciona entre 1 y 4 asientos mínimos.');
  }
  return { timeFrom, timeTo, minSeats: minSeats ? Number(minSeats) : 0 };
}

// No modifica ni guarda las rutas: conserva el orden recibido.
function filterRoutes(routes, { timeFrom = '', timeTo = '', minSeats = 0 } = {}) {
  return routes.filter(route => {
    if (timeFrom && (!TIME.test(route.time) || route.time < timeFrom)) return false;
    if (timeTo && (!TIME.test(route.time) || route.time > timeTo)) return false;
    if (Number(route.seats) < minSeats) return false;
    return true;
  });
}

module.exports = { parseRouteFilters, filterRoutes };
