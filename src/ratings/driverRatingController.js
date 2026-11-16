// ratings/driverRatingController.js
// US24 - Calificar conductor después del viaje.

const { findDriverRating, createDriverRating, getDriverRatingSummary } = require('./ratingModel');
const { findBookingById, getBookingsByPassenger, BOOKING_STATUS } = require('../trips/bookingModel');
const { findUserById } = require('../auth/userModel');

// Un viaje se considera "finalizado" cuando pasa su hora de salida (misma regla que la US25,
// porque la aplicación no tiene una acción de "finalizar viaje"). Si se quiere esperar
// una duración estimada, se puede definir TRIP_DURATION_MINUTES en el .env (por defecto 0).
const TRIP_DURATION_MINUTES = Number.isFinite(Number(process.env.TRIP_DURATION_MINUTES))
  ? Number(process.env.TRIP_DURATION_MINUTES)
  : 0;

const MAX_COMMENT_LENGTH = 300;

const getUserId = (req) => req.session?.userId || null;

/**
 * Momento (ms) en que el viaje de una reserva se considera finalizado.
 */
function getTripEndTimestamp(booking) {
  const departure = Number(booking?.routeSnapshot?.expiresAtTimestamp);
  if (!Number.isFinite(departure) || departure <= 0) return null;
  return departure + TRIP_DURATION_MINUTES * 60 * 1000;
}

function isTripFinished(booking, now = Date.now()) {
  const end = getTripEndTimestamp(booking);
  return end !== null && end <= now;
}

function getDriverName(driverId) {
  const driver = driverId ? findUserById(driverId) : null;
  if (!driver) return 'Conductor';
  return `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Conductor';
}

/**
 * GET /ratings/passenger/trips
 * Viajes reservados por el pasajero con su estado de calificación:
 *  - "por_calificar": el viaje terminó y aún no lo calificó
 *  - "en_curso": el viaje todavía no termina (no se puede calificar)
 *  - "calificado": ya lo calificó
 */
function getMyTripsToRate(req, res) {
  try {
    const passengerId = getUserId(req);
    const now = Date.now();
    const trips = getBookingsByPassenger(passengerId)
      .filter(booking => booking.status === BOOKING_STATUS.CONFIRMED && booking.driverId)
      .map(booking => {
        const rating = findDriverRating({
          routeId: booking.routeId,
          passengerId: booking.passengerId,
          driverId: booking.driverId,
        });
        const finished = isTripFinished(booking, now);

        let ratingStatus = 'en_curso';
        if (rating) ratingStatus = 'calificado';
        else if (finished) ratingStatus = 'por_calificar';

        return {
          bookingId: booking.id,
          routeId: booking.routeId,
          driverId: booking.driverId,
          driverName: getDriverName(booking.driverId),
          origin: booking.routeSnapshot?.origin || '',
          dest: booking.routeSnapshot?.dest || '',
          time: booking.routeSnapshot?.time || '',
          tripEndsAt: getTripEndTimestamp(booking),
          ratingStatus,
          rating: rating ? { score: rating.score, comment: rating.comment } : null,
        };
      });

    // Primero los que están por calificar, luego los en curso y al final los calificados
    const order = { por_calificar: 0, en_curso: 1, calificado: 2 };
    trips.sort((a, b) => order[a.ratingStatus] - order[b.ratingStatus]);

    return res.status(200).json(trips);
  } catch (error) {
    console.error('Error en getMyTripsToRate:', error);
    return res.status(500).json({ error: 'No se pudieron cargar tus viajes.' });
  }
}

/**
 * POST /ratings/drivers
 * Body: { bookingId, score (1-5), comment? }
 */
function rateDriver(req, res) {
  try {
    const passengerId = getUserId(req);
    const bookingId = String(req.body?.bookingId || '').trim();
    const score = Number(req.body?.score);
    const comment = String(req.body?.comment || '').trim();

    if (!bookingId) {
      return res.status(400).json({ error: 'No se indicó el viaje a calificar.' });
    }

    // Escenario 03: valor inválido
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'La calificación debe ser un número entero entre 1 y 5.' });
    }

    if (comment.length > MAX_COMMENT_LENGTH) {
      return res.status(400).json({ error: `El comentario no puede superar los ${MAX_COMMENT_LENGTH} caracteres.` });
    }

    const booking = findBookingById(bookingId);

    if (!booking || booking.passengerId !== String(passengerId)) {
      return res.status(404).json({ error: 'No encontramos ese viaje entre tus reservas.' });
    }

    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      return res.status(409).json({ error: 'No puedes calificar un viaje que fue cancelado.' });
    }

    if (!booking.driverId) {
      return res.status(409).json({ error: 'Este viaje no tiene un conductor asociado.' });
    }

    // Escenario 02: el viaje aún no termina
    if (!isTripFinished(booking)) {
      return res.status(409).json({ error: 'Solo puedes calificar al conductor cuando el viaje haya finalizado.' });
    }

    // Escenario 04: calificación duplicada
    if (findDriverRating({ routeId: booking.routeId, passengerId, driverId: booking.driverId })) {
      return res.status(409).json({ error: 'Ya calificaste a este conductor por este viaje.' });
    }

    const rating = createDriverRating({ booking, score, comment });

    return res.status(201).json({
      message: '¡Gracias! Tu calificación fue registrada.',
      rating,
      driverSummary: getDriverRatingSummary(booking.driverId),
    });
  } catch (error) {
    console.error('Error en rateDriver:', error);
    return res.status(500).json({ error: 'Hubo un problema al guardar la calificación.' });
  }
}

/**
 * GET /ratings/drivers/:driverId/summary
 * Reputación pública del conductor (promedio y cantidad de calificaciones).
 */
function getDriverSummary(req, res) {
  try {
    return res.status(200).json(getDriverRatingSummary(req.params.driverId));
  } catch (error) {
    console.error('Error en getDriverSummary:', error);
    return res.status(500).json({ error: 'No se pudo obtener la reputación del conductor.' });
  }
}

module.exports = {
  TRIP_DURATION_MINUTES,
  isTripFinished,
  getMyTripsToRate,
  rateDriver,
  getDriverSummary,
};
