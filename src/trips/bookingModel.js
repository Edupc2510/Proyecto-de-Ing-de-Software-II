// trips/bookingModel.js
// Persistencia de reservas (solicitudes de viaje) en data/bookings.json.
//
// Cada reserva guarda una "foto" de la ruta (routeSnapshot) para que el historial
// siga disponible aunque la ruta original se elimine al vencer o al cancelarse.

const { v4: uuidv4 } = require('uuid');
const { createJsonStore } = require('../shared/jsonStore');

const store = createJsonStore('bookings.json');

const BOOKING_STATUS = {
  CONFIRMED: 'confirmada',
  CANCELLED: 'cancelada',
};

const getBookings = () => store.read();
const saveBookings = (bookings) => store.write(bookings);

/**
 * Registra una nueva reserva de un pasajero sobre una ruta.
 */
function createBooking({ route, passengerId }) {
  const bookings = getBookings();

  const booking = {
    id: uuidv4(),
    routeId: String(route.id),
    driverId: route.driverId ? String(route.driverId) : null,
    passengerId: String(passengerId),
    status: BOOKING_STATUS.CONFIRMED,
    routeSnapshot: {
      origin: route.origin,
      dest: route.dest,
      time: route.time,
      expiresAtTimestamp: route.expiresAtTimestamp || null,
    },
    createdAt: new Date().toISOString(),
  };

  bookings.push(booking);

  if (!saveBookings(bookings)) {
    throw new Error('No se pudo guardar la reserva.');
  }

  return booking;
}

function findBookingById(bookingId) {
  return getBookings().find(b => b.id === String(bookingId)) || null;
}

function getBookingsByRoute(routeId) {
  return getBookings().filter(b => b.routeId === String(routeId));
}

function getBookingsByPassenger(passengerId) {
  return getBookings().filter(b => b.passengerId === String(passengerId));
}

/**
 * Marca como canceladas todas las reservas activas de una ruta.
 * @returns {Array} Las reservas que fueron canceladas
 */
function cancelBookingsByRoute(routeId, reason) {
  const bookings = getBookings();
  const cancelled = [];
  const now = new Date().toISOString();

  bookings.forEach((booking, index) => {
    if (booking.routeId === String(routeId) && booking.status === BOOKING_STATUS.CONFIRMED) {
      bookings[index] = {
        ...booking,
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: now,
        cancelReason: reason || null,
      };
      cancelled.push(bookings[index]);
    }
  });

  if (cancelled.length > 0 && !saveBookings(bookings)) {
    throw new Error('No se pudieron cancelar las reservas de la ruta.');
  }

  return cancelled;
}

module.exports = {
  BOOKING_STATUS,
  getBookings,
  saveBookings,
  createBooking,
  findBookingById,
  getBookingsByRoute,
  getBookingsByPassenger,
  cancelBookingsByRoute,
};
