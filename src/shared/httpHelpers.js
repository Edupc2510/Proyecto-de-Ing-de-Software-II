// shared/httpHelpers.js
// Utilidades HTTP para los módulos de Sprint 2-4 (solicitudes, reservas,
// conductores frecuentes y reclamos).

/**
 * Middleware para endpoints JSON: responde 401 en JSON si no hay sesión
 * (en vez de redirigir), para que el frontend pueda mostrar el mensaje.
 */
function requireSessionJson(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, error: 'Debes iniciar sesión.' });
  }
  next();
}

/**
 * Error de dominio con código HTTP asociado. Los servicios lanzan este error
 * y los controladores lo traducen a una respuesta JSON.
 */
class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'DomainError';
    this.status = status;
  }
}

/**
 * Envuelve un handler de controlador para centralizar el manejo de errores.
 */
function handle(fn, contexto) {
  return (req, res) => {
    try {
      const resultado = fn(req, res);
      if (resultado && typeof resultado.catch === 'function') {
        resultado.catch(error => responderError(res, error, contexto));
      }
    } catch (error) {
      responderError(res, error, contexto);
    }
  };
}

function responderError(res, error, contexto) {
  if (error instanceof DomainError) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  console.error(`[${contexto}]`, error);
  return res.status(500).json({ success: false, error: 'Ocurrió un error interno. Inténtalo nuevamente.' });
}

module.exports = { requireSessionJson, DomainError, handle };
