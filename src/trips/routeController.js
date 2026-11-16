// Importamos las funciones desde el modelo
const {
    getRoutes,
    saveRoutes,
    ROUTE_STATUS,
    isRouteCancelled,
    isRouteExpired,
    isRouteActive
} = require('./routeModel');
const {
    BOOKING_STATUS,
    createBooking,
    getBookings,
    getBookingsByRoute,
    cancelBookingsByRoute
} = require('./bookingModel');
const { findUserById } = require('../auth/userModel');
// Patrón Observer: el controlador solo anuncia lo que pasó; las notificaciones (US14, US31, US34)
// y los strikes (US34) los manejan los observadores registrados en src/shared/events.
const { tripEvents, TRIP_EVENTS } = require('../shared/events/tripEvents');
const { getDriverRatingSummary } = require('../ratings/ratingModel');
const { parseRouteFilters, filterRoutes } = require('./routeFilters');
const { validateNotes } = require('./tripNotes');
const { validatePickupPoint } = require('./pickupValidator');
const { AccountFacade } = require('../account/accountFacade');

// US32: política de cuenta (una cuenta pausada no aparece en búsquedas ni recibe solicitudes)
const cuentas = AccountFacade.crearPorDefecto();

// Palabra que el conductor debe escribir para confirmar la cancelación (US34 - Escenario 03)
const CANCEL_CONFIRMATION_WORD = 'CANCELAR';

const getFullName = (user) =>
    user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '';


/**
 * Elimina del JSON solo las rutas vencidas que no están canceladas.
 * Las rutas canceladas se conservan como historial del conductor (US34)
 * y las rutas llenas (0 asientos) se conservan para que el conductor
 * pueda seguir viendo sus solicitudes (US14).
 */
const cleanupExpiredRoutes = (routes, now = Date.now()) => {
    // US36 necesita conservar el vínculo histórico también para el conductor.
    // La disponibilidad se filtra al consultar, sin borrar registros.
    return routes;
};

// A partir de aquí ya podemos usar getRoutes() y saveRoutes() en tus funciones del controlador
// 1. Crear la función para obtener todas las rutas
const getAllRoutes = (req, res) => {
    let filters;
    try { filters = parseRouteFilters(req.query); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    try {
        // 1. Traer todas las rutas del archivo JSON
        const allRoutes = getRoutes();
        const ahora = Date.now(); // Milisegundos de la hora actual exacta

        // 2. Limpiar del JSON las rutas vencidas (las canceladas se guardan como historial)
        const storedRoutes = cleanupExpiredRoutes(allRoutes, ahora);

        // 3. FILTRAR: solo rutas vigentes, con asientos y NO canceladas (US34)
        const validRoutes = storedRoutes
            .filter(route => isRouteActive(route, ahora))
            .filter(route => cuentas.estaVisible(route.driverId)) // US32: cuenta pausada
            .map(route => {
                const driver = route.driverId ? findUserById(route.driverId) : null;
                return {
                    ...route,
                    driverName: getFullName(driver) || null,
                    driverRating: route.driverId ? getDriverRatingSummary(route.driverId) : null
                };
            });

        // 4. Devolver solo las rutas válidas al pasajero
        res.status(200).json(filterRoutes(validRoutes, filters));
        
    } catch (error) {
        console.error("Error en getAllRoutes:", error);
        res.status(500).json({ error: "Hubo un problema al obtener las rutas" });
    }
};




const publishRoute = (req, res) => {
    try {
        const body = req.body || {};

        const origin = String(body.origin || '').trim();
        const dest = String(body.dest || '').trim();
        const time = String(body.time || '').trim();
        const notesError = validateNotes(body.notes ?? '', false);
        if (notesError) return res.status(400).json({ error: notesError });
        const notes = (body.notes || '').trim();

        const seats = Number(body.seats);
        const originCoords = body.originCoords;
        const destCoords = body.destCoords;

        if (!origin) {
            return res.status(400).json({
                error: "El origen es obligatorio."
            });
        }

        if (!dest) {
            return res.status(400).json({
                error: "El destino es obligatorio."
            });
        }

        if (!time) {
            return res.status(400).json({
                error: "La hora de salida es obligatoria."
            });
        }

        if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
            return res.status(400).json({
                error: "Los asientos disponibles deben estar entre 1 y 4."
            });
        }

        if (origin.toLowerCase() === dest.toLowerCase()) {
            return res.status(400).json({
                error: "El origen y el destino no pueden ser iguales."
            });
        }

        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

        if (!timeRegex.test(time)) {
            return res.status(400).json({
                error: "La hora debe tener el formato HH:mm."
            });
        }

        if (!Array.isArray(originCoords) || originCoords.length !== 2) {
            return res.status(400).json({
                error: "Debes seleccionar el origen desde las sugerencias de dirección."
            });
        }

        const originLat = Number(originCoords[0]);
        const originLng = Number(originCoords[1]);

        if (
            !Number.isFinite(originLat) ||
            !Number.isFinite(originLng) ||
            originLat < -90 ||
            originLat > 90 ||
            originLng < -180 ||
            originLng > 180
        ) {
            return res.status(400).json({
                error: "Las coordenadas del origen no son válidas."
            });
        }

        if (!Array.isArray(destCoords) || destCoords.length !== 2) {
            return res.status(400).json({
                error: "Debes seleccionar el destino desde las sugerencias de dirección."
            });
        }

        const destLat = Number(destCoords[0]);
        const destLng = Number(destCoords[1]);

        if (
            !Number.isFinite(destLat) ||
            !Number.isFinite(destLng) ||
            destLat < -90 ||
            destLat > 90 ||
            destLng < -180 ||
            destLng > 180
        ) {
            return res.status(400).json({
                error: "Las coordenadas del destino no son válidas."
            });
        }

        const [hours, minutes] = time.split(':').map(Number);

        const expiresAt = new Date();
        expiresAt.setHours(hours, minutes, 0, 0);

        if (expiresAt.getTime() <= Date.now()) {
            return res.status(400).json({
                error: "La hora de salida no puede estar vencida."
            });
        }

        const routes = getRoutes();

        const newRoute = {
            id: Date.now(),
            driverId: req.session?.userId || null,
            origin,
            originCoords: [originLat, originLng],
            dest,
            destCoords: [destLat, destLng],
            seats,
            initialSeats: seats,
            totalSeats: seats,
            time,
            notes,
            expiresAtTimestamp: expiresAt.getTime(),
            status: ROUTE_STATUS.ACTIVE,
            createdAt: new Date().toISOString()
        };

        routes.unshift(newRoute);

        const saved = saveRoutes(routes);

        if (!saved) {
            throw new Error("No se pudo guardar la ruta en el archivo JSON.");
        }

        // US31: anunciar la nueva ruta (el observador de notificaciones busca coincidencias)
        tripEvents.publish(TRIP_EVENTS.ROUTE_PUBLISHED, { route: newRoute });

        return res.status(201).json({
            message: "Ruta publicada correctamente",
            route: newRoute
        });

    } catch (error) {
        console.error("Error en publishRoute:", error);

        return res.status(500).json({
            error: "Hubo un problema al publicar la ruta."
        });
    }
};
const joinRoute = (req, res) => {
    try {
        const routeId = String(req.body?.routeId ?? '').trim();
        const passengerId = req.session?.userId || null;

        if (!passengerId) {
            return res.status(401).json({
                error: "Debes iniciar sesión para reservar un asiento."
            });
        }

        if (!routeId) {
            return res.status(400).json({
                error: "No se recibió el ID de la ruta seleccionada."
            });
        }

        const routes = getRoutes();

        // Comparación segura: funciona aunque el ID venga como string o number
        const routeIndex = routes.findIndex(route => String(route.id) === routeId);

        if (routeIndex === -1) {
            return res.status(404).json({
                error: "La ruta ya no está disponible o no existe."
            });
        }

        const route = routes[routeIndex];

        // US34: una ruta cancelada ya no acepta reservas
        if (isRouteCancelled(route)) {
            return res.status(410).json({
                error: "El conductor canceló esta ruta."
            });
        }

        if (route.driverId && String(route.driverId) === String(passengerId)) {
            return res.status(403).json({
                error: "No puedes reservar un asiento en tu propia ruta."
            });
        }

        // US32: un conductor con la cuenta pausada no recibe solicitudes
        if (route.driverId && !cuentas.puedeRecibirSolicitudes(route.driverId)) {
            return res.status(409).json({
                error: "El conductor pausó su cuenta y no recibe solicitudes por ahora."
            });
        }

        const alreadyBooked = getBookingsByRoute(route.id).some(booking =>
            booking.passengerId === String(passengerId) &&
            booking.status === BOOKING_STATUS.CONFIRMED
        );

        if (alreadyBooked) {
            return res.status(409).json({
                error: "Ya tienes una reserva en esta ruta."
            });
        }

        // Verificar si la ruta ya venció antes de permitir la reserva
        const expiresAtTimestamp = Number(route.expiresAtTimestamp);
        const hasExpiration = Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp > 0;

        if (hasExpiration && expiresAtTimestamp <= Date.now()) {
            return res.status(410).json({
                error: "Esta ruta ya venció y fue retirada de la lista."
            });
        }

        // Validar asientos disponibles
        const currentSeats = Number(route.seats);

        if (!Number.isInteger(currentSeats) || currentSeats <= 0) {
            return res.status(409).json({
                error: "Lo sentimos, ya no quedan asientos disponibles."
            });
        }

        // US21: validar el punto de recojo elegido por el pasajero (si lo envia)
        let pickupPoint = null;

        if (req.body?.pickupPoint) {
            const pickupResult = validatePickupPoint(req.body.pickupPoint, route);

            if (!pickupResult.valid) {
                return res.status(pickupResult.status).json({
                    error: pickupResult.error
                });
            }

            pickupPoint = pickupResult.pickupPoint;
        }

        // Restar un asiento de forma segura
        const remainingSeats = currentSeats - 1;

        // Actualizamos los asientos. Si llega a 0 la ruta deja de mostrarse a los pasajeros
        // (isRouteActive), pero se conserva para que el conductor vea sus solicitudes (US14).
        routes[routeIndex] = {
            ...route,
            seats: remainingSeats
        };

        const saved = saveRoutes(routes);
        if (!saved) {
            throw new Error("No se pudieron guardar los cambios de la ruta.");
        }

        // US14: registrar la solicitud del pasajero para que el conductor la vea
        const booking = createBooking({ route, passengerId, pickupPoint });

        // US14: anunciar la reserva (el observador de notificaciones avisa al conductor)
        tripEvents.publish(TRIP_EVENTS.BOOKING_CREATED, {
            route,
            booking,
            passengerName: getFullName(findUserById(passengerId))
        });

        return res.status(200).json({
            message: "¡Te has unido a la ruta con éxito!",
            remainingSeats,
            routeRemoved: remainingSeats === 0,
            bookingId: booking.id
        });

    } catch (error) {
        console.error("Error en joinRoute:", error);

        return res.status(500).json({
            error: "Hubo un problema al unirse a la ruta."
        });
    }
};
const getMyPublishedRoutes = (req, res) => {
    try {
        const currentUserId = req.session?.userId || null;

        if (!currentUserId) {
            return res.status(401).json({
                error: "Debes iniciar sesión para ver tus rutas publicadas."
            });
        }

        const now = Date.now();

        // Limpia rutas vencidas (las canceladas se conservan como historial)
        const routes = cleanupExpiredRoutes(getRoutes(), now);
        const bookings = getBookings();

        // Rutas vigentes del conductor (incluye rutas llenas para poder ver sus solicitudes)
        const myRoutes = routes
            .filter(route =>
                String(route.driverId) === String(currentUserId) &&
                !isRouteCancelled(route) &&
                !isRouteExpired(route, now)
            )
            .map(route => ({
                ...route,
                requestsCount: bookings.filter(b =>
                    b.routeId === String(route.id) && b.status === BOOKING_STATUS.CONFIRMED
                ).length
            }));

        return res.status(200).json(myRoutes);

    } catch (error) {
        console.error("Error en getMyPublishedRoutes:", error);

        return res.status(500).json({
            error: "Hubo un problema al obtener tus rutas publicadas."
        });
    }
};
/**
 * GET /trips/:routeId
 * Detalle de una ruta disponible. Se usa al tocar una notificación de
 * coincidencia (US31 - Escenario 03) para abrir directamente el viaje.
 */
const getRouteById = (req, res) => {
    try {
        const routeId = String(req.params.routeId || '').trim();
        const route = getRoutes().find(r => String(r.id) === routeId);

        if (!route) {
            return res.status(404).json({
                error: "Este viaje ya no existe."
            });
        }

        if (isRouteCancelled(route)) {
            return res.status(410).json({
                error: "El conductor canceló este viaje."
            });
        }

        if (!isRouteActive(route)) {
            return res.status(410).json({
                error: "Este viaje ya no está disponible (venció o no tiene asientos)."
            });
        }

        const driver = route.driverId ? findUserById(route.driverId) : null;

        return res.status(200).json({
            ...route,
            driverName: getFullName(driver) || null,
            driverRating: route.driverId ? getDriverRatingSummary(route.driverId) : null
        });

    } catch (error) {
        console.error("Error en getRouteById:", error);
        return res.status(500).json({
            error: "Hubo un problema al obtener el viaje."
        });
    }
};

/**
 * GET /trips/:routeId/requests
 * US14 - El conductor visualiza las solicitudes (reservas) de pasajeros de su ruta.
 */
const getRouteRequests = (req, res) => {
    try {
        const routeId = String(req.params.routeId || '').trim();
        const currentUserId = req.session?.userId || null;

        if (!currentUserId) {
            return res.status(401).json({
                error: "Debes iniciar sesión para ver las solicitudes."
            });
        }

        const route = getRoutes().find(r => String(r.id) === routeId);

        if (!route) {
            return res.status(404).json({
                error: "La ruta no existe."
            });
        }

        if (String(route.driverId) !== String(currentUserId)) {
            return res.status(403).json({
                error: "Solo el conductor de la ruta puede ver sus solicitudes."
            });
        }

        const requests = getBookingsByRoute(routeId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(booking => {
                const passenger = findUserById(booking.passengerId);

                return {
                    id: booking.id,
                    passengerName: getFullName(passenger) || 'Pasajero',
                    passengerEmail: passenger?.email || null,
                    // US21 (Camila): punto de recojo elegido por el pasajero, si lo indicó
                    pickupAddress: booking.pickupPoint?.address || null,
                    status: booking.status,
                    requestedAt: booking.createdAt,
                    cancelledAt: booking.cancelledAt || null
                };
            });

        return res.status(200).json({
            route: {
                id: route.id,
                origin: route.origin,
                dest: route.dest,
                time: route.time,
                seats: route.seats,
                status: route.status || ROUTE_STATUS.ACTIVE
            },
            requests,
            confirmedCount: requests.filter(r => r.status === BOOKING_STATUS.CONFIRMED).length
        });

    } catch (error) {
        console.error("Error en getRouteRequests:", error);
        return res.status(500).json({
            error: "Hubo un problema al cargar las solicitudes."
        });
    }
};

/**
 * DELETE /trips/:routeId
 * US34 - Cancelar ruta publicada.
 * Body: { confirmation: "CANCELAR", reason?: string }
 *
 * - Solo el conductor dueño puede cancelar y debe confirmar escribiendo "CANCELAR".
 * - La ruta pasa a estado "cancelada" (se conserva como historial) y deja de
 *   aparecer en la búsqueda de pasajeros.
 * - Las reservas activas pasan a "cancelada" y cada pasajero recibe una
 *   notificación de prioridad alta.
 * - Si faltan menos de 15 minutos para la salida y había pasajeros confirmados,
 *   se registra un strike oculto en el historial de fiabilidad del conductor.
 */
const cancelPublishedRoute = (req, res) => {
    try {
        const routeId = String(req.params.routeId || '').trim();
        const currentUserId = req.session?.userId || null;
        const confirmation = String(req.body?.confirmation || '').trim();
        const reason = String(req.body?.reason || '').trim().slice(0, 200);

        if (!currentUserId) {
            return res.status(401).json({
                error: "Debes iniciar sesión para cancelar una ruta."
            });
        }

        if (!routeId) {
            return res.status(400).json({
                error: "No se recibió el ID de la ruta."
            });
        }

        // Escenario 03: confirmación de seguridad
        if (confirmation !== CANCEL_CONFIRMATION_WORD) {
            return res.status(400).json({
                error: `Para confirmar debes escribir la palabra ${CANCEL_CONFIRMATION_WORD}.`
            });
        }

        const routes = getRoutes();
        const routeIndex = routes.findIndex(route => String(route.id) === routeId);

        if (routeIndex === -1) {
            return res.status(404).json({
                error: "La ruta ya no existe."
            });
        }

        const route = routes[routeIndex];

        // Solo el conductor que publicó la ruta puede cancelarla
        if (!route.driverId || String(route.driverId) !== String(currentUserId)) {
            return res.status(403).json({
                error: "No tienes permiso para cancelar esta ruta."
            });
        }

        if (isRouteCancelled(route)) {
            return res.status(409).json({
                error: "Esta ruta ya fue cancelada."
            });
        }

        const now = Date.now();

        if (isRouteExpired(route, now)) {
            return res.status(409).json({
                error: "La hora de salida ya pasó, este viaje no puede cancelarse."
            });
        }

        // Escenario 01: cambiar estado a CANCELADO (sale de los resultados de búsqueda)
        routes[routeIndex] = {
            ...route,
            status: ROUTE_STATUS.CANCELLED,
            cancelledAt: new Date(now).toISOString(),
            cancelReason: reason || null
        };

        const saved = saveRoutes(routes);

        if (!saved) {
            throw new Error("No se pudo guardar la cancelación de la ruta.");
        }

        // Escenario 02: liberar a los pasajeros y avisarles con prioridad alta
        const cancelledBookings = cancelBookingsByRoute(route.id, reason);

        // Escenarios 02 y 04: anunciar la cancelación. Los observadores avisan a los
        // pasajeros (prioridad alta) y registran el strike si fue tardía.
        tripEvents.publish(TRIP_EVENTS.ROUTE_CANCELLED, {
            route,
            driverId: currentUserId,
            cancelledBookings,
            reason,
            cancelledAt: now
        });

        return res.status(200).json({
            message: cancelledBookings.length > 0
                ? `Ruta cancelada. Se notificó a ${cancelledBookings.length} pasajero(s).`
                : "Ruta cancelada correctamente.",
            affectedPassengers: cancelledBookings.length
        });

    } catch (error) {
        console.error("Error en cancelPublishedRoute:", error);

        return res.status(500).json({
            error: "Hubo un problema al cancelar la ruta."
        });
    }
};

/**
 * GET /trips/mine/cancelled
 * US34 - Historial de rutas canceladas del conductor.
 */
const getMyCancelledRoutes = (req, res) => {
    try {
        const currentUserId = req.session?.userId || null;

        if (!currentUserId) {
            return res.status(401).json({
                error: "Debes iniciar sesión para ver tu historial."
            });
        }

        const cancelled = getRoutes()
            .filter(route => String(route.driverId) === String(currentUserId) && isRouteCancelled(route))
            .sort((a, b) => new Date(b.cancelledAt) - new Date(a.cancelledAt));

        return res.status(200).json(cancelled);

    } catch (error) {
        console.error("Error en getMyCancelledRoutes:", error);
        return res.status(500).json({
            error: "Hubo un problema al obtener tu historial de rutas canceladas."
        });
    }
};

/**
 * POST /trips/:routeId/reactivate
 * US34 - Escenario 05: los viajes cancelados no pueden reabrirse.
 */
const reactivateRoute = (req, res) => {
    try {
        const routeId = String(req.params.routeId || '').trim();
        const currentUserId = req.session?.userId || null;
        const route = getRoutes().find(r => String(r.id) === routeId);

        if (!route) {
            return res.status(404).json({
                error: "La ruta no existe."
            });
        }

        if (String(route.driverId) !== String(currentUserId)) {
            return res.status(403).json({
                error: "No tienes permiso sobre esta ruta."
            });
        }

        if (isRouteCancelled(route)) {
            return res.status(409).json({
                error: "Los viajes cancelados no pueden reabrirse. Por favor, publica una nueva ruta."
            });
        }

        return res.status(400).json({
            error: "Esta ruta no está cancelada."
        });

    } catch (error) {
        console.error("Error en reactivateRoute:", error);
        return res.status(500).json({
            error: "Hubo un problema al procesar la solicitud."
        });
    }
};

//expottasndo las funciones del controlador
module.exports = {
    getAllRoutes,
    getRouteById,
    publishRoute,
    joinRoute,
    cancelPublishedRoute,
    getMyPublishedRoutes,
    getMyCancelledRoutes,
    reactivateRoute,
    getRouteRequests
};
