// src/trips/routeEditController.js
// US33 - Endpoints para que el conductor edite una ruta publicada.

const { getRoutes, saveRoutes } = require('./routeModel');
const {
  EDIT_LOCK_MINUTES,
  LOCK_MESSAGE,
  FIELD_LABELS,
  RouteEditError,
  getActiveBookings,
  getRouteCapacity,
  isEditLocked,
  applyRouteEdit,
} = require('./routeEditService');
const { tripEvents, TRIP_EVENTS } = require('../shared/events/tripEvents');

const findRoute = (routes, routeId) =>
  routes.findIndex((route) => String(route.id) === String(routeId));

function handleError(res, error, context) {
  if (error instanceof RouteEditError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(`Error en ${context}:`, error);
  return res.status(500).json({ error: 'Hubo un problema al editar la ruta.' });
}

/**
 * GET /trips/:routeId/edit
 * Datos para abrir el formulario de edicion.
 * US33 - Escenario 02: si faltan menos de 30 minutos, se bloquea el acceso.
 */
const getRouteForEdit = (req, res) => {
  try {
    const userId = req.session?.userId || null;
    if (!userId) return res.status(401).json({ error: 'Debes iniciar sesi\u00f3n.' });

    const routes = getRoutes();
    const route = routes[findRoute(routes, req.params.routeId)];

    if (!route) throw new RouteEditError('La ruta ya no existe.', 404);
    if (String(route.driverId) !== String(userId)) {
      throw new RouteEditError('No tienes permiso para editar esta ruta.', 403);
    }
    if (isEditLocked(route)) throw new RouteEditError(LOCK_MESSAGE, 409);

    return res.status(200).json({
      route: {
        id: route.id,
        origin: route.origin,
        dest: route.dest,
        time: route.time,
        notes: route.notes || '',
      },
      capacity: getRouteCapacity(route),
      editLockMinutes: EDIT_LOCK_MINUTES,
    });
  } catch (error) {
    return handleError(res, error, 'getRouteForEdit');
  }
};

/**
 * PUT /trips/:routeId
 * body: { time?, totalSeats?, notes? }
 * US33 - Escenarios 01 a 04: guardar los cambios de la ruta.
 */
const editPublishedRoute = (req, res) => {
  try {
    const userId = req.session?.userId || null;
    if (!userId) return res.status(401).json({ error: 'Debes iniciar sesi\u00f3n.' });

    const routes = getRoutes();
    const index = findRoute(routes, req.params.routeId);
    const route = routes[index];

    const { updatedRoute, changedFields, capacity } = applyRouteEdit({
      route,
      userId,
      changes: req.body || {},
    });

    routes[index] = updatedRoute;

    if (!saveRoutes(routes)) {
      throw new Error('No se pudo guardar la ruta editada.');
    }

    // US33 - Escenario 03: avisar a los pasajeros con reserva activa (patron Observer)
    const affectedBookings = getActiveBookings(updatedRoute.id);
    const changedLabels = changedFields.map((field) => FIELD_LABELS[field] || field);

    tripEvents.publish(TRIP_EVENTS.ROUTE_UPDATED, {
      route: updatedRoute,
      previousRoute: route,
      changedFields,
      changedLabels,
      affectedBookings,
    });

    return res.status(200).json({
      message: affectedBookings.length > 0
        ? `Ruta actualizada. Se notific\u00f3 a ${affectedBookings.length} pasajero(s).`
        : 'Ruta actualizada correctamente.',
      route: updatedRoute,
      capacity,
      changedFields,
      notifiedPassengers: affectedBookings.length,
    });
  } catch (error) {
    return handleError(res, error, 'editPublishedRoute');
  }
};

module.exports = { getRouteForEdit, editPublishedRoute };
