// Importamos las funciones desde el modelo
const { getRoutes, saveRoutes } = require('./routeModel');
// US27-US28: ordenamiento de viajes
const { sortRoutes, normalizeSortKey } = require('./routeSort');

// A partir de aquí ya podemos usar getRoutes() y saveRoutes() en tus funciones del controlador
// 1. Crear la función para obtener todas las rutas
const getAllRoutes = (req, res) => {
    try {
        // 1. Traer todas las rutas del archivo JSON
        const allRoutes = getRoutes();
        const ahora = Date.now(); // Milisegundos de la hora actual exacta

        // 2. FILTRAR: solo se retiran las rutas VENCIDAS.
        //    Las rutas sin asientos se conservan para mostrarse al final con la
        //    etiqueta "Agotado"
        const validRoutes = allRoutes.filter(route => {
            return route.expiresAtTimestamp ? route.expiresAtTimestamp > ahora : true;
        });

        // 3. OPTIMIZACIÓN: si se venció alguna ruta, actualizamos el JSON para limpiarlo
        if (validRoutes.length !== allRoutes.length) {
            saveRoutes(validRoutes);
            console.log(`[Backend] Se eliminaron ${allRoutes.length - validRoutes.length} rutas vencidas.`);
        }

        // 4. ORDENAR (US27 - US28). Criterio recibido por query: /trips?sort=soonest
        //    Valores: soonest | latest | most-seats | last-seats
        const sortKey = normalizeSortKey(req.query.sort);

        const routesToSend = sortRoutes(validRoutes, sortKey).map(route => ({
            ...route,
            soldOut: !(Number(route.seats) > 0)
        }));

        // La lista cambia con cada reserva: que el navegador no la guarde en caché
        res.set('Cache-Control', 'no-store');
        res.status(200).json(routesToSend);

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
        const notes = String(body.notes || '').trim();

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
            time,
            notes,
            expiresAtTimestamp: expiresAt.getTime(),
            createdAt: new Date().toISOString()
        };

        routes.unshift(newRoute);

        const saved = saveRoutes(routes);

        if (!saved) {
            throw new Error("No se pudo guardar la ruta en el archivo JSON.");
        }

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

        // Verificar si la ruta ya venció antes de permitir la reserva
        const expiresAtTimestamp = Number(route.expiresAtTimestamp);
        const hasExpiration = Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp > 0;

        if (hasExpiration && expiresAtTimestamp <= Date.now()) {
            routes.splice(routeIndex, 1);

            const saved = saveRoutes(routes);
            if (!saved) {
                throw new Error("No se pudo eliminar la ruta expirada.");
            }

            return res.status(410).json({
                error: "Esta ruta ya venció y fue retirada de la lista."
            });
        }

        // Validar asientos disponibles
        const currentSeats = Number(route.seats);

        if (!Number.isInteger(currentSeats) || currentSeats <= 0) {
            // La ruta se conserva (aparece como "Agotado"); solo se rechaza la reserva
            return res.status(409).json({
                error: "Lo sentimos, ya no quedan asientos disponibles."
            });
        }

        // Restar un asiento de forma segura
        const remainingSeats = currentSeats - 1;

        // Se actualiza siempre la ruta. Si queda en 0 asientos NO se borra:
        // se mostrara al final de la lista con la etiqueta "Agotado" (US28).
        routes[routeIndex] = {
            ...route,
            seats: remainingSeats
        };

        const saved = saveRoutes(routes);
        if (!saved) {
            throw new Error("No se pudieron guardar los cambios de la ruta.");
        }

        return res.status(200).json({
            message: "¡Te has unido a la ruta con éxito!",
            remainingSeats,
            soldOut: remainingSeats === 0
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

        const routes = getRoutes();

        const now = Date.now();

        // Solo se descartan las vencidas; una ruta llena sigue siendo del conductor
        const activeRoutes = routes.filter(route => {
            const expiresAtTimestamp = Number(route.expiresAtTimestamp);

            return Number.isFinite(expiresAtTimestamp) &&
                expiresAtTimestamp > now;
        });

        // Limpia rutas vencidas
        if (activeRoutes.length !== routes.length) {
            saveRoutes(activeRoutes);
        }

        const myRoutes = activeRoutes.filter(route => {
            return String(route.driverId) === String(currentUserId);
        });

        return res.status(200).json(myRoutes);

    } catch (error) {
        console.error("Error en getMyPublishedRoutes:", error);

        return res.status(500).json({
            error: "Hubo un problema al obtener tus rutas publicadas."
        });
    }
};
const cancelPublishedRoute = (req, res) => {
    try {
        const routeId = String(req.params.routeId || '').trim();
        const currentUserId = req.session?.userId || null;

        if (!routeId) {
            return res.status(400).json({
                error: "No se recibió el ID de la ruta."
            });
        }

        const routes = getRoutes();
        const routeIndex = routes.findIndex(route => String(route.id) === routeId);

        if (routeIndex === -1) {
            return res.status(404).json({
                error: "La ruta ya no existe o ya fue cancelada."
            });
        }

        const route = routes[routeIndex];

        // Si la ruta tiene conductor asociado, solo ese conductor puede cancelarla.
        if (route.driverId && currentUserId && String(route.driverId) !== String(currentUserId)) {
            return res.status(403).json({
                error: "No tienes permiso para cancelar esta ruta."
            });
        }

        routes.splice(routeIndex, 1);

        const saved = saveRoutes(routes);

        if (!saved) {
            throw new Error("No se pudo guardar la cancelación de la ruta.");
        }

        return res.status(200).json({
            message: "Ruta cancelada correctamente."
        });

    } catch (error) {
        console.error("Error en cancelPublishedRoute:", error);

        return res.status(500).json({
            error: "Hubo un problema al cancelar la ruta."
        });
    }
};
//expottasndo las funciones del controlador
module.exports = {
    getAllRoutes,
    publishRoute,
    joinRoute,
    cancelPublishedRoute,
    getMyPublishedRoutes
};