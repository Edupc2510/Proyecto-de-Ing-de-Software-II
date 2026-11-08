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

/**
 * Variante para endpoints JSON (fetch): siempre responde 401 en JSON
 * en lugar de redirigir, para que el frontend pueda mostrar el error.
 */
function requireApiAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Debes iniciar sesión.' });
  }
  next();
}

module.exports = { requireAuth, requireApiAuth };
