const fs = require('node:fs');
const path = require('node:path');


/** Adaptador de los registros que preparan las ramas del equipo.
 * Solo expone viajes vinculados al usuario; nunca confía en un rol del navegador.
 */
class TripAccessRepository {
  constructor(directory = process.env.MOVESHARE_DATA_DIR || path.join(__dirname, '../../data')) {
    this.directory = directory;
  }

  read(filename) {
    const target = path.join(this.directory, filename);
    if (!fs.existsSync(target)) return [];
    const rows = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('El archivo de viajes no contiene una lista.');
    return rows;
  }

  getForUser(userId) {
    const trips = new Map();
    const add = (record, snapshot, routeId, reservationId = null) => {
      if (record.demo || routeId == null) return;
      let role;
      if (String(record.driverId) === String(userId)) role = 'driver';
      else if (String(record.passengerId) === String(userId)) role = 'passenger';
      else return;
      const key = String(routeId);
      if (!trips.has(key)) trips.set(key, {
        routeId: key, role, reservationId: role === 'passenger' ? reservationId : null,
        origin: snapshot.origin || '', dest: snapshot.dest || '', time: snapshot.time || '',
      });
    };
    for (const row of this.read('bookings.json')) add(row, row.routeSnapshot || {}, row.routeId, row.id);
    for (const row of this.read('routes.json')) add(row, row, row.id);
    return [...trips.values()];
  }

  hasReservations(route) {
    const capacity = Number.isInteger(route.totalSeats) ? route.totalSeats : route.initialSeats;
    if (Number.isInteger(capacity) && route.seats < capacity) return true;
    if (this.read('bookings.json').some(row => String(row.routeId) === String(route.id) && row.status === 'confirmada')) return true;
    return false;
  }

}

module.exports = { TripAccessRepository };
