// src/trips/tripHistoryController.js
// US23 - Endpoint del historial de viajes del pasajero.

const { buildTripHistory, isValidDateFilter } = require('./tripHistoryService');

/**
 * GET /trips/history?from=AAAA-MM-DD&to=AAAA-MM-DD
 * Devuelve los viajes del pasajero en sesion (filtro por fecha opcional).
 */
const getMyTripHistory = (req, res) => {
    try {
        const passengerId = req.session?.userId || null;

        if (!passengerId) {
            return res.status(401).json({
                error: 'Debes iniciar sesi\u00f3n para ver tu historial de viajes.'
            });
        }

        const from = String(req.query?.from || '').trim();
        const to = String(req.query?.to || '').trim();

        // US23 - Escenario 03: validar el filtro por fecha
        if (!isValidDateFilter(from) || !isValidDateFilter(to)) {
            return res.status(400).json({
                error: 'Las fechas del filtro deben tener el formato AAAA-MM-DD.'
            });
        }

        if (from && to && from > to) {
            return res.status(400).json({
                error: 'La fecha "desde" no puede ser posterior a la fecha "hasta".'
            });
        }

        // US23 - Escenarios 01 y 02: lista de viajes (puede estar vacia)
        const trips = buildTripHistory(passengerId, { from, to });

        return res.status(200).json({ trips, total: trips.length });

    } catch (error) {
        // US23 - Escenario 04: error de carga
        console.error('Error en getMyTripHistory:', error);

        return res.status(500).json({
            error: 'No se pudo cargar tu historial de viajes. Int\u00e9ntalo de nuevo.'
        });
    }
};

module.exports = { getMyTripHistory };
