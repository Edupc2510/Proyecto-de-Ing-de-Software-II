const express = require('express');
const router = express.Router();

// Importamos las funciones del controlador
const {
    getAllRoutes,
    publishRoute,
    joinRoute,
    cancelPublishedRoute,
    getMyPublishedRoutes
} = require('./routeController');

// Obtener todas las rutas
router.get('/', getAllRoutes);

// Publicar una nueva ruta
router.post('/', publishRoute);
//registrar end point para unirse a la ruta 
router.post('/join', joinRoute);
//eliminar ruta 
router.delete('/:routeId', cancelPublishedRoute);
//
router.get('/mine', getMyPublishedRoutes);
module.exports = router;