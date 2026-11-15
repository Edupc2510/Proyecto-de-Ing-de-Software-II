// myTrips/demoSeeder.js
// Genera datos de demostración para el pasajero en sesión, para poder
// presentar US15, US17, US30, US35 y US37 mientras las HU de creación de
// solicitudes/reservas/reclamos de otros integrantes se integran.
//
// Todos los registros se marcan con demo: true y se reemplazan cada vez que
// se vuelve a generar. Los conductores de demo usan datos ficticios.

const { SolicitudDAO } = require('../requests/requestDAO');
const { crearSolicitud, REQUEST_STATUS } = require('../requests/requestModel');
const { ReservaDAO } = require('../reservations/reservationDAO');
const { crearReserva, RESERVATION_STATUS, PARTICIPATION_STATUS } = require('../reservations/reservationModel');
const { HistorialParticipacionDAO } = require('../reservations/participationCommands');
const { ContactoConductorDAO } = require('../drivers/driverContactDAO');
const { ReclamoDAO } = require('../claims/claimDAO');
const { ReclamoFacade } = require('../claims/claimFacade');
const { CLAIM_STATUS } = require('../claims/claimModel');

const HORA = 3600 * 1000;
const DIA = 24 * HORA;

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

function rutaEn(ruta, offsetMs) {
  const salida = new Date(Date.now() + offsetMs);
  salida.setSeconds(0, 0);
  return {
    ...ruta,
    time: `${String(salida.getHours()).padStart(2, '0')}:${String(salida.getMinutes()).padStart(2, '0')}`,
    departureAt: salida.toISOString(),
  };
}

function haceMs(ms) {
  return new Date(Date.now() - ms).toISOString();
}

function limpiarDemo(passengerId) {
  const esDemo = r => r.demo === true && String(r.passengerId) === String(passengerId);
  const reservaDAO = new ReservaDAO();
  const idsReservasDemo = new Set(reservaDAO.buscar(esDemo).map(r => r.id));

  new SolicitudDAO().eliminarDonde(esDemo);
  reservaDAO.eliminarDonde(esDemo);
  new ReclamoDAO().eliminarDonde(esDemo);
  new HistorialParticipacionDAO().eliminarDonde(r => idsReservasDemo.has(r.reservationId));
  new ContactoConductorDAO().eliminarDonde(c => String(c.passengerId) === String(passengerId) && String(c.driverId).startsWith('demo-driver-'));
}

function sembrarReservas(passengerId) {
  const dao = new ReservaDAO();
  const crear = (conductor, ruta, offset, extra = {}) => {
    const reserva = crearReserva({
      passengerId,
      routeId: `demo-route-${Math.abs(offset)}`,
      driverId: conductor.id,
      driver: conductor,
      route: rutaEn(ruta, offset),
      price: 8.5,
      demo: true,
    });
    reserva.createdAt = haceMs(Math.max(DIA, -offset + DIA));
    return dao.guardar({ ...reserva, ...extra });
  };

  // Próximas (US17 + US35)
  const proxima = crear(CONDUCTORES.carla, RUTAS.ulima, 3 * HORA);
  crear(CONDUCTORES.lucia, RUTAS.laMolina, 20 * HORA, {
    participation: { status: PARTICIPATION_STATUS.CONFIRMED, updatedAt: haceMs(2 * HORA), note: 'Asistencia confirmada por el pasajero.' },
  });
  crear(CONDUCTORES.jorge, RUTAS.sanMiguel, 2 * DIA + 4 * HORA);

  // Historial: viajes completados (alimentan US30 - conductores frecuentes)
  const completadaCarla = crear(CONDUCTORES.carla, RUTAS.ulima, -2 * DIA);
  crear(CONDUCTORES.carla, RUTAS.ulima, -5 * DIA);
  crear(CONDUCTORES.carla, RUTAS.regreso, -9 * DIA);
  crear(CONDUCTORES.jorge, RUTAS.sanMiguel, -3 * DIA);
  crear(CONDUCTORES.jorge, RUTAS.sanMiguel, -7 * DIA);
  crear(CONDUCTORES.lucia, RUTAS.laMolina, -4 * DIA);
  crear(CONDUCTORES.lucia, RUTAS.laMolina, -12 * DIA);
  crear(CONDUCTORES.renzo, RUTAS.regreso, -6 * DIA);

  // Cancelada
  crear(CONDUCTORES.jorge, RUTAS.sanMiguel, -1 * DIA, {
    status: RESERVATION_STATUS.CANCELLED,
    cancelReason: 'El conductor canceló la ruta por un imprevisto.',
  });

  return { proxima, completadaCarla };
}

function sembrarSolicitudes(passengerId, reservaProxima) {
  const dao = new SolicitudDAO();
  const crear = (conductor, ruta, offset, estados = [], extra = {}) => {
    const base = crearSolicitud({
      passengerId,
      routeId: `demo-route-req-${Math.abs(offset)}`,
      driverId: conductor.id,
      driver: conductor,
      route: rutaEn(ruta, offset),
      message: '¡Hola! Voy a la universidad, ¿me puedes llevar?',
      demo: true,
    });
    const creada = haceMs(estados.length * 2 * HORA + HORA);
    base.createdAt = creada;
    base.history[0].at = creada;
    estados.forEach(([status, note], i) => {
      base.status = status;
      base.history.push({ status, at: haceMs((estados.length - i) * 2 * HORA), note });
    });
    base.updatedAt = base.history[base.history.length - 1].at;
    return dao.guardar({ ...base, ...extra });
  };

  crear(CONDUCTORES.renzo, RUTAS.regreso, 1 * DIA);
  crear(CONDUCTORES.carla, RUTAS.ulima, 3 * HORA, [[REQUEST_STATUS.ACCEPTED, 'El conductor aceptó la solicitud.']], {
    reservationId: reservaProxima.id,
  });
  crear(CONDUCTORES.jorge, RUTAS.sanMiguel, 6 * HORA, [[REQUEST_STATUS.REJECTED, 'El conductor rechazó la solicitud.']], {
    responseNote: 'Ya no tengo asientos disponibles para esa hora.',
  });
  crear(CONDUCTORES.lucia, RUTAS.laMolina, 2 * DIA, [[REQUEST_STATUS.CANCELLED, 'Cancelada por el pasajero.']]);
  // Pendiente con salida ya pasada: al listar se marca automáticamente como "expirada"
  crear(CONDUCTORES.renzo, RUTAS.sanMiguel, -2 * HORA);
}

function sembrarReclamos(passengerId, reservaCompletada) {
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
  const { proxima, completadaCarla } = sembrarReservas(passengerId);
  sembrarSolicitudes(passengerId, proxima);
  sembrarReclamos(passengerId, completadaCarla);
}

module.exports = { generarDatosDemo, limpiarDemo };
