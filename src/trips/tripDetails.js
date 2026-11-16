const { validateNotes, MAX_NOTES_LENGTH } = require('./tripNotes');
const { editPublishedRoute } = require('./routeEditController');

// US22 reutiliza las reglas y notificaciones de US33, pero solo permite editar notas.
function updateTripDetails(req, res) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Inicia sesión para editar los detalles.' });
  const error = validateNotes(req.body?.notes);
  if (error) return res.status(400).json({ error });
  req.body = { notes: req.body.notes };
  return editPublishedRoute(req, res);
}

module.exports = { validateNotes, updateTripDetails, MAX_NOTES_LENGTH };
