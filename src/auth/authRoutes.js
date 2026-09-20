// routes/authRoutes.js
// Rutas de autenticación: registro, verificación, login, logout

const express = require('express');
const router = express.Router();
const authController = require('./authController');

// POST /auth/register - Registrar nuevo usuario
router.post('/register', authController.register);

// POST /auth/verify - Verificar código de 6 dígitos
router.post('/verify', authController.verifyCode);

// POST /auth/login - Iniciar sesión
router.post('/login', authController.login);

// POST /auth/logout - Cerrar sesión
router.post('/logout', authController.logout);

// GET /auth/me - Obtener datos del usuario en sesión
router.get('/me', authController.getMe);

router.post('/resend-code', authController.reenviarCodigo);

module.exports = router;
