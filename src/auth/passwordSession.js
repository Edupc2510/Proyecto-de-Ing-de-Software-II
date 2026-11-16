const { findUserById } = require('./userModel');

// Después de recuperar la contraseña, las sesiones anteriores dejan de dar acceso.
function expireChangedPasswordSession(req, res, next) {
  if (!req.session?.userId) return next();
  const user = findUserById(req.session.userId);
  if (user && (user.passwordVersion || 0) === (req.session.passwordVersion || 0)) return next();
  req.session.regenerate(error => {
    if (error) return next(error);
    next();
  });
}

module.exports = { expireChangedPasswordSession };
