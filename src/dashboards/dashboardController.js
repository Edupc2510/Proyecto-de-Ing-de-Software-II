// controllers/dashboardController.js
// Controlador del dashboard principal (vista post-login)

// CORRECCIÓN: Importamos la función desde el modelo de usuarios en src/auth
const { findUserById } = require('../auth/userModel'); 

/**
 * GET /dashboard
 * Renderiza el dashboard principal. Requiere sesión activa.
 */
function getDashboard(req, res) {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  return res.sendFile('dashboard.html', { root: './views' });
}

/**
 * GET /dashboard/profile
 * Retorna los datos del perfil del usuario autenticado.
 */
function getProfile(req, res) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }

  const user = findUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
  }

  // NOTA: Asegúrate de que las propiedades coincidan con cómo están escritas en tu users.json
  // Si en tu JSON dice "nombre", cambia 'user.firstName' por 'user.nombre'
  return res.status(200).json({
    success: true,
    user: {
      firstName: user.firstName || user.nombre || 'Usuario', 
      lastName: user.lastName || user.apellido || '',
      email: user.email,
      dni: user.dni,
      createdAt: user.createdAt,
    },
  });
}

module.exports = { getDashboard, getProfile };