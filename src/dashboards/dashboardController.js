// controllers/dashboardController.js
// Controlador del dashboard principal (vista post-login)

// CORRECCIÓN: Importamos la función desde el modelo de usuarios en src/auth
const { findUserById, updateUser } = require('../auth/userModel');
// US19: validación de la edición de perfil
const { validateProfileUpdate } = require('./profileValidator');

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

  return res.status(200).json({
    success: true,
    user: toPublicProfile(user),
  });
}

/**
 * Datos del usuario que se pueden enviar al navegador (nunca la contraseña).
 * Acepta los nombres antiguos "nombre" y "apellido" por compatibilidad con
 * usuarios creados antes del cambio a firstName / lastName.
 */
function toPublicProfile(user) {
  return {
    firstName: user.firstName || user.nombre || 'Usuario',
    lastName: user.lastName || user.apellido || '',
    email: user.email,
    dni: user.dni,
    createdAt: user.createdAt,
  };
}

/**
 * PUT /dashboard/profile   (US19 - Editar perfil)
 * Actualiza nombre y apellido del usuario autenticado.
 *
 * - Solo se pueden editar los campos permitidos (nombre y apellido). Si el
 *   cuerpo trae email, dni, contraseña u otros, se ignoran.
 * - Siempre se edita al usuario de la SESIÓN: no se recibe ningún id.
 */
function updateProfile(req, res) {
  // US19 esc. 05: sesión expirada
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Tu sesión expiró. Inicia sesión nuevamente.',
    });
  }

  const user = findUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
  }

  // US19 esc. 02 y 03: campos inválidos o vacíos
  const result = validateProfileUpdate(req.body, {
    firstName: user.firstName || user.nombre,
    lastName: user.lastName || user.apellido,
  });

  if (!result.ok) {
    return res.status(400).json({
      success: false,
      message: result.message,
      errors: result.errors,
    });
  }

  // US19 esc. 04: sin cambios -> no se escribe nada en users.json
  if (Object.keys(result.changes).length === 0) {
    return res.status(200).json({
      success: true,
      updated: false,
      message: 'No hay cambios para guardar.',
      user: toPublicProfile(user),
    });
  }

  // US19 esc. 01: edición exitosa
  const saved = updateUser(user.id, result.changes);
  if (!saved) {
    return res.status(500).json({ success: false, message: 'No se pudo guardar el perfil.' });
  }

  return res.status(200).json({
    success: true,
    updated: true,
    message: 'Perfil actualizado correctamente.',
    user: toPublicProfile(saved),
  });
}

module.exports = { getDashboard, getProfile, updateProfile };