const express = require('express');
const router = express.Router();

// Importamos las funciones del controlador
const {
    getAllRoutes,
    getRouteById,
    publishRoute,
    joinRoute,
    cancelPublishedRoute,
    getMyPublishedRoutes,
    getMyCancelledRoutes,
    reactivateRoute,
    getRouteRequests
} = require('./routeController');

// Obtener todas las rutas
router.get('/', getAllRoutes);

// Publicar una nueva ruta
router.post('/', publishRoute);
//registrar end point para unirse a la ruta
router.post('/join', joinRoute);
// Rutas publicadas por el conductor en sesión
// (deben ir antes de '/:routeId' para que "mine" no se tome como un ID)
router.get('/mine', getMyPublishedRoutes);
// US34 - Historial de rutas canceladas del conductor
router.get('/mine/cancelled', getMyCancelledRoutes);
// US14 - Solicitudes de pasajeros de una ruta
router.get('/:routeId/requests', getRouteRequests);
// US34 - Intento de reactivar una ruta cancelada (siempre bloqueado)
router.post('/:routeId/reactivate', reactivateRoute);
// US31 - Detalle de un viaje (al abrir una notificación de coincidencia)
router.get('/:routeId', getRouteById);
// US34 - Cancelar ruta
router.delete('/:routeId', cancelPublishedRoute);

module.exports = router;
