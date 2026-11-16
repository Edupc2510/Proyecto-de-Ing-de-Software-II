// myTrips/demoSeeder.js
// Genera datos de demostración para el pasajero en sesión, para poder
// presentar US15, US17, US30, US35 y US37 sin tener que crear rutas y viajes
// reales con varias cuentas.
//
// Las solicitudes/reservas se guardan en el modelo de la US14
// (data/bookings.json) con el mismo formato que createBooking(), más campos
// opcionales (driverSnapshot, history, price...). Todos se marcan con
// demo: true, usan rutas ficticias "demo-route-*" y se reemplazan cada vez.

const { v4: uuidv4 } = require('uuid');
const bookingModel = require('../trips/bookingModel');
const { PARTICIPATION_STATUS } = require('../reservations/reservationModel');
const { HistorialParticipacionDAO } = require('../reservations/participationCommands');
const { ContactoConductorDAO } = require('../drivers/driverContactDAO');
const { ReclamoDAO } = require('../claims/claimDAO');
const { ReclamoFacade } = require('../claims/claimFacade');
const { CLAIM_STATUS } = require('../claims/claimModel');

const HORA = 3600 * 1000;
const DIA = 24 * HORA;

// Conductores ficticios (no son usuarios registrados)
const CONDUCTORES = {
  carla: { id: 'demo-driver-1', name: 'Carla Mendoza', phone: '900 000 101', email: 'carla.mendoza@demo.moveshare.pe', vehicle: 'Kia Rio gris · ABC-123' },
  jorge: { id: 'demo-driver-2', name: 'Jorge Salas', phone: '900 000 102', email: null, vehicle: 'Toyota Yaris azul · XYZ-789' },
  lucia: { id: 'demo-driver-3', name: 'Lucía Paredes', phone: null, email: 'lucia.paredes@demo.moveshare.pe', vehicle: 'Hyundai Accent blanco · LMN-456' },
  renzo: { id: 'demo-driver-4', name: 'Renzo Quispe', phone: '900 000 104', email: null, vehicle: 'Nissan Versa negro · QRS-321' },
};

const RUTAS = {
  ulima: { origin: 'Av. Arequipa con Javier Prado, Miraflores', dest: 'Universidad de Lima, Santiago de Surco' },
  sanMiguel: { origin: 'Plaza San Miguel, San Miguel', dest: 'Universidad de Lima, Santiago de Surco' },
  laMolina: { origin: 'Óvalo La Molina, La Molina', dest: 'Universidad de Lima, Santiago de Surco' },
  regreso: { origin: 'Universidad de Lima, Santiago de Surco', dest: 'Parque Kennedy, Miraflores' },
};

const haceMs = ms => new Date(Date.now() - ms).toISOString();

function snapshotRuta(ruta, offsetMs) {
  const salida = new Date(Date.now() + offsetMs);
  salida.setSeconds(0, 0);
  return {
    ...ruta,
    time: `${String(salida.getHours()).padStart(2, '0')}:${String(salida.getMinutes()).padStart(2, '0')}`,
    expiresAtTimestamp: salida.getTime(),
  };
}

/** Booking con el mismo formato que bookingModel.createBooking() + campos opcionales */
function booking(passengerId, conductor, ruta, offset, extra = {}) {
  const { id: driverId, ...driverSnapshot } = conductor;
  return {
    id: uuidv4(),
    routeId: `demo-route-${uuidv4().slice(0, 8)}`,
    driverId,
    passengerId: String(passengerId),
    status: 'confirmada',
    routeSnapshot: snapshotRuta(ruta, offset),
    createdAt: haceMs(Math.max(DIA, -offset + DIA)),
    driverSnapshot,
    price: 8.5,
    demo: true,
    ...extra,
  };
}

function limpiarDemo(passengerId) {
  const esDemo = b => b.demo === true && String(b.passengerId) === String(passengerId);
  const todos = bookingModel.getBookings();
  const idsDemo = new Set(todos.filter(esDemo).map(b => b.id));
  if (idsDemo.size && !bookingModel.saveBookings(todos.filter(b => !idsDemo.has(b.id)))) {
    throw new Error('No se pudieron limpiar los datos de demostración.');
  }

  new ReclamoDAO().eliminarDonde(esDemo);
  new HistorialParticipacionDAO().eliminarDonde(r => idsDemo.has(r.reservationId));
  new ContactoConductorDAO().eliminarDonde(c => String(c.passengerId) === String(passengerId) && String(c.driverId).startsWith('demo-driver-'));
}

function crearBookings(passengerId) {
  const b = (...args) => booking(passengerId, ...args);
  const enviada = (horas) => ({ status: 'pendiente', at: haceMs(horas * HORA), note: 'Solicitud enviada al conductor.' });

  const proxima = b(CONDUCTORES.carla, RUTAS.ulima, 3 * HORA, {
    history: [enviada(5), { status: 'confirmada', at: haceMs(4 * HORA), note: 'El conductor aceptó la solicitud.' }],
  });
  const completadaCarla = b(CONDUCTORES.carla, RUTAS.ulima, -2 * DIA);

  const lista = [
    // US17 / US35: próximas
    proxima,
    b(CONDUCTORES.lucia, RUTAS.laMolina, 20 * HORA, {
      participation: { status: PARTICIPATION_STATUS.CONFIRMED, updatedAt: haceMs(2 * HORA), note: 'Asistencia confirmada por el pasajero.' },
    }),
    b(CONDUCTORES.jorge, RUTAS.sanMiguel, 2 * DIA + 4 * HORA),

    // US17 historial + US30 conductores frecuentes
    completadaCarla,
    b(CONDUCTORES.carla, RUTAS.ulima, -5 * DIA),
    b(CONDUCTORES.carla, RUTAS.regreso, -9 * DIA),
    b(CONDUCTORES.jorge, RUTAS.sanMiguel, -3 * DIA),
    b(CONDUCTORES.jorge, RUTAS.sanMiguel, -7 * DIA),
    b(CONDUCTORES.lucia, RUTAS.laMolina, -4 * DIA),
    b(CONDUCTORES.lucia, RUTAS.laMolina, -12 * DIA),
    b(CONDUCTORES.renzo, RUTAS.regreso, -6 * DIA),

    // Cancelada por el conductor (igual que cancelBookingsByRoute)
    b(CONDUCTORES.jorge, RUTAS.sanMiguel, -1 * DIA, {
      status: 'cancelada', cancelledAt: haceMs(30 * HORA), cancelReason: 'El conductor canceló la ruta por un imprevisto.',
    }),

    // US15: solicitudes en otros estados
    b(CONDUCTORES.renzo, RUTAS.regreso, 1 * DIA, { status: 'pendiente', message: '¡Hola! ¿Me puedes llevar a Miraflores?', history: [enviada(1)] }),
    b(CONDUCTORES.jorge, RUTAS.sanMiguel, 6 * HORA, {
      status: 'rechazada',
      responseNote: 'Ya no tengo asientos disponibles para esa hora.',
      history: [enviada(6), { status: 'rechazada', at: haceMs(4 * HORA), note: 'El conductor rechazó la solicitud.' }],
    }),
    b(CONDUCTORES.lucia, RUTAS.laMolina, 2 * DIA, {
      status: 'cancelada', cancelledBy: 'pasajero', cancelledAt: haceMs(2 * HORA), cancelReason: 'Cancelada por el pasajero.',
      history: [enviada(3), { status: 'cancelada', at: haceMs(2 * HORA), note: 'Cancelada por el pasajero.' }],
    }),
    // Pendiente con salida ya pasada: se muestra como "expirada"
    b(CONDUCTORES.renzo, RUTAS.sanMiguel, -2 * HORA, { status: 'pendiente', history: [enviada(8)] }),
  ];

  if (!bookingModel.saveBookings([...bookingModel.getBookings(), ...lista])) {
    throw new Error('No se pudieron guardar los datos de demostración.');
  }
  return { completadaCarla };
}

function crearReclamos(passengerId, reservaCompletada) {
  const facade = new ReclamoFacade();
  const dao = new ReclamoDAO();

  const crear = (datos, estados) => {
    const reclamo = facade.registrarReclamo(passengerId, { ...datos, demo: true });
    const inicio = estados.length ? estados[0][2] + 6 * HORA : 2 * HORA;
    const history = [{ status: CLAIM_STATUS.REGISTERED, at: haceMs(inicio), note: 'Reclamo registrado.' }];
    estados.forEach(([status, note, hace]) => history.push({ status, at: haceMs(hace), note }));
    const ultimo = history[history.length - 1];
    dao.actualizar(reclamo.id, {
      status: ultimo.status,
      history,
      createdAt: history[0].at,
      updatedAt: ultimo.at,
      assignedAgent: estados.length ? 'Andrea V. (Soporte MoveShare)' : null,
      response: datos.response || null,
    });
  };

  crear(
    {
      reservationId: reservaCompletada.id,
      category: 'seguridad',
      subject: 'El conductor excedió la velocidad en la Vía Expresa',
      description: 'Durante el viaje el conductor manejó muy rápido y no respetó las señales. Me sentí insegura.',
      response: 'Revisamos el caso y la conductora recibió una advertencia formal y una capacitación de manejo seguro. Gracias por reportarlo.',
    },
    [
      [CLAIM_STATUS.IN_REVIEW, 'Caso asignado al equipo de seguridad.', 40 * HORA],
      [CLAIM_STATUS.IN_PROGRESS, 'Contactamos a la conductora para su descargo.', 30 * HORA],
      [CLAIM_STATUS.RESOLVED, 'Se aplicó una advertencia formal.', 20 * HORA],
    ]
  );

  crear(
    { category: 'cobro', subject: 'Me cobraron dos veces el mismo viaje', description: 'En mi billetera aparecen dos cargos de S/ 8.50 por el viaje del lunes.' },
    [
      [CLAIM_STATUS.IN_REVIEW, 'Validando los cargos con la pasarela de pagos.', 50 * HORA],
      [CLAIM_STATUS.IN_PROGRESS, 'Se solicitó la devolución del cargo duplicado.', 26 * HORA],
    ]
  );

  crear({ category: 'objeto_perdido', subject: 'Olvidé mi casaca en el auto', description: 'Dejé una casaca azul en el asiento trasero del viaje de esta mañana.' }, []);

  crear(
    { category: 'ruta', subject: 'El conductor cambió el punto de recojo', description: 'El punto de recojo fue distinto al publicado en la ruta.' },
    [
      [CLAIM_STATUS.IN_REVIEW, 'Revisando el historial de la ruta.', 90 * HORA],
      [CLAIM_STATUS.REJECTED, 'El cambio fue notificado en la app con 30 minutos de anticipación.', 80 * HORA],
    ]
  );
}

function generarDatosDemo(passengerId) {
  limpiarDemo(passengerId);
  const { completadaCarla } = crearBookings(passengerId);
  crearReclamos(passengerId, completadaCarla);
}

module.exports = { generarDatosDemo, limpiarDemo };
