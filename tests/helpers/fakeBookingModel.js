// tests/helpers/fakeBookingModel.js
// Doble de prueba en memoria con la misma interfaz que src/trips/bookingModel.js,
// para no escribir en data/bookings.json durante las pruebas.

const { randomUUID } = require('crypto');

function crearFakeBookingModel(inicial = []) {
  let bookings = [...inicial];
  return {
    getBookings: () => bookings.map(b => ({ ...b })),
    saveBookings: nuevos => { bookings = nuevos.map(b => ({ ...b })); return true; },
    findBookingById: id => bookings.find(b => b.id === String(id)) || null,
    getBookingsByPassenger: id => bookings.filter(b => b.passengerId === String(id)),
    agregar(datos) {
      const b = { id: randomUUID(), status: 'confirmada', createdAt: new Date().toISOString(), ...datos };
      bookings.push(b);
      return b;
    },
  };
}

/** Booking mínimo con salida a "offsetMs" desde ahora */
function datosBooking({ passengerId = 'p1', driverId = 'd1', driverName = 'Ana', offsetMs = 3600e3, ...extra } = {}) {
  return {
    routeId: randomUUID(),
    driverId,
    passengerId,
    routeSnapshot: { origin: 'A', dest: 'B', time: '07:30', expiresAtTimestamp: Date.now() + offsetMs },
    driverSnapshot: { name: driverName, phone: extra.phone || null, email: extra.email || null },
    ...extra,
  };
}

module.exports = { crearFakeBookingModel, datosBooking };
