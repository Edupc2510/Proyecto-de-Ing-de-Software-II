const { getRoutes, saveRoutes } = require('./routeModel');
const { TripAccessRepository } = require('./tripAccessRepository');

const MAX_NOTES_LENGTH = 500;
function validateNotes(notes, required = true) {
  if (typeof notes !== 'string') return 'Los detalles deben ser texto.';
  if (required && !notes.trim()) return 'Escribe los detalles del viaje.';
  if (notes.trim().length > MAX_NOTES_LENGTH) return 'Los detalles pueden tener hasta 500 caracteres.';
  return null;
}

function updateTripDetails(req, res) {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: 'Inicia sesión para editar los detalles.' });
  const error = validateNotes(req.body?.notes);
  if (error) return res.status(400).json({ error });
  try {
    const routes = getRoutes();
    const route = routes.find(row => String(row.id) === req.params.routeId);
    if (!route) return res.status(404).json({ error: 'La ruta ya no existe.' });
    if (String(route.driverId) !== String(userId)) return res.status(403).json({ error: 'Solo el conductor de esta ruta puede editarla.' });
    const departure = Number(route.expiresAtTimestamp);
    if (route.status === 'cancelada' || !Number.isFinite(departure) || departure <= Date.now()) {
      return res.status(409).json({ error: 'La ruta ya salió o fue cancelada.' });
    }
    if (new TripAccessRepository().hasReservations(route)) {
      return res.status(409).json({ error: 'No puedes cambiar los detalles de una ruta con reservas.' });
    }
    // Las rutas antiguas de Main no registraban el total ni las reservas.
    if (!Number.isInteger(route.initialSeats)) {
      return res.status(409).json({ error: 'Esta ruta antigua no permite comprobar sus reservas. Publica una nueva para editar sus detalles.' });
    }
    route.notes = req.body.notes.trim();
    route.detailsUpdatedAt = new Date().toISOString();
    if (!saveRoutes(routes)) throw new Error('No se pudieron guardar los detalles.');
    return res.json({ message: 'Detalles actualizados.', route });
  } catch {
    return res.status(500).json({ error: 'No se pudieron guardar los detalles. Intenta nuevamente.' });
  }
}

module.exports = { validateNotes, updateTripDetails, MAX_NOTES_LENGTH };
