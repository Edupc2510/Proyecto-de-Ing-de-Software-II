// middleware/authMiddleware.js
// Middleware para proteger rutas que requieren sesión activa

/**
 * Verifica que el usuario tenga una sesión válida.
 * Si no la tiene, redirige a la página principal (login).
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    // Para peticiones AJAX, responder con JSON
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.path.startsWith('/api')) {
      return res.status(401).json({ success: false, message: 'Sesión requerida.' });
    }
    return res.redirect('/');
  }
  next();
}

module.exports = { requireAuth };
