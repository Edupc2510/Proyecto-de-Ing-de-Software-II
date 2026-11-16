// requests/requestModel.js
// Estados de una Solicitud de viaje (US15).
//
// Las solicitudes NO tienen un modelo propio: son los registros del modelo de
// la US14 (src/trips/bookingModel.js, data/bookings.json). Este archivo solo
// define los estados que la vista de US15 sabe mostrar.
//   - "confirmada" en bookings.json  -> la solicitud fue ACEPTADA
//   - "cancelada"                    -> CANCELADA (por el pasajero o porque el conductor canceló la ruta)
//   - "pendiente" / "rechazada"      -> soportados para cuando exista aprobación manual del conductor
//   - "expirada"                     -> se calcula al mostrar: pendiente cuyo viaje ya salió

const REQUEST_STATUS = Object.freeze({
  PENDING: 'pendiente',
  ACCEPTED: 'aceptada',
  REJECTED: 'rechazada',
  CANCELLED: 'cancelada',
  EXPIRED: 'expirada',
});

/** Estado guardado en bookings.json -> estado de la solicitud */
const DESDE_BOOKING = Object.freeze({
  pendiente: REQUEST_STATUS.PENDING,
  confirmada: REQUEST_STATUS.ACCEPTED,
  rechazada: REQUEST_STATUS.REJECTED,
  cancelada: REQUEST_STATUS.CANCELLED,
});

module.exports = { REQUEST_STATUS, DESDE_BOOKING };
