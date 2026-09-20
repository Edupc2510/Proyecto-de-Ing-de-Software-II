// controllers/authController.js
// Controlador de autenticación: registro, verificación, login, logout

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { findUserByEmail, createUser, updateUser } = require('./userModel');
const { sendVerificationEmail } = require('./emailService');

// Almacenamiento temporal en memoria para códigos de verificación pendientes.
// Estructura: { email: { code, expiresAt, userId } }
const pendingVerifications = {};

/**
 * Genera un código numérico aleatorio de 6 dígitos.
 * @returns {string}
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Valida que un correo tenga formato válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Valida que un DNI peruano tenga 8 dígitos numéricos.
 * @param {string} dni
 * @returns {boolean}
 */
function isValidDNI(dni) {
  return /^\d{8}$/.test(dni);
}

// ─────────────────────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { firstName, lastName, email, dni, password } = req.body;

    // Validaciones de campos vacíos
    if (!firstName || !lastName || !email || !dni || !password) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
    }

    // Validación de correo
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'El correo electrónico no es válido.' });
    }

    // Validación de DNI
    if (!isValidDNI(dni)) {
      return res.status(400).json({ success: false, message: 'El DNI debe tener exactamente 8 dígitos numéricos.' });
    }

    // Validación de contraseña mínima
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Verificar duplicado
    const existing = findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Ya existe una cuenta con ese correo electrónico.' });
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario (no verificado aún)
    const newUser = {
      id: uuidv4(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      dni: dni.trim(),
      password: hashedPassword,
      verified: false,
      createdAt: new Date().toISOString(),
    };
    try {
      createUser(newUser);
      console.log('[AuthController] Usuario guardado exitosamente en el modelo.');
    } catch (modelError) {
      console.error('[CRÍTICO] Error al ejecutar createUser en el modelo:', modelError);
      return res.status(500).json({ success: false, message: 'Error al escribir en la base de datos local.' });
    }

    // Generar y guardar código de verificación (válido 15 minutos)
    const code = generateVerificationCode();
    pendingVerifications[email.toLowerCase()] = {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
      userId: newUser.id,
    };

    // Enviar correo con el código
    //const emailSent = await sendVerificationEmail(email, firstName, code);
    let emailSent = false;

    try {
      emailSent = await sendVerificationEmail(email, firstName, code);
      } catch (error) {
        console.error('[Email Service Error]:', error.message);
    }

    if (!emailSent) {
      // Aviso: el usuario fue creado pero el correo falló.
      // En desarrollo sin credenciales reales, mostramos el código en consola.
      console.log(`[DEV] Código de verificación para ${email}: ${code}`);
      return res.status(200).json({
        success: true,
        message: 'Cuenta creada. No se pudo enviar el correo (revisa las credenciales en .env). Código en consola del servidor.',
        devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cuenta creada. Se envió un código de verificación a tu correo.',
    });
  } catch (error) {
    console.error('[AuthController] register error:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /auth/verify
// ─────────────────────────────────────────────────────────────
async function verifyCode(req, res) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Correo y código son requeridos.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const pending = pendingVerifications[normalizedEmail];

    if (!pending) {
      return res.status(400).json({ success: false, message: 'No hay un código de verificación pendiente para ese correo.' });
    }

    if (Date.now() > pending.expiresAt) {
      delete pendingVerifications[normalizedEmail];
      return res.status(400).json({ success: false, message: 'El código ha expirado. Por favor regístrate nuevamente.' });
    }

    if (pending.code !== code.trim()) {
      return res.status(400).json({ success: false, message: 'Código incorrecto. Inténtalo de nuevo.' });
    }

    // Marcar usuario como verificado
    updateUser(pending.userId, { verified: true });
    delete pendingVerifications[normalizedEmail];

    return res.status(200).json({ success: true, message: '¡Cuenta verificada exitosamente! Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('[AuthController] verifyCode error:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
}

/// ─────────────────────────────────────────────────────────────
// POST /auth/resend-code
// ─────────────────────────────────────────────────────────────
async function reenviarCodigo(req, res) {
  try {
    const { email } = req.body; 
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'El correo es obligatorio.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(404).json({ success: false, message: 'No existe un usuario con ese correo.' });
    }

    if (user.verified) {
      return res.status(400).json({ success: false, message: 'Esta cuenta ya está verificada.' });
    }

    // Generar nuevo código
    const code = generateVerificationCode();
    pendingVerifications[normalizedEmail] = {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
      userId: user.id,
    };

    // Enviar por correo
    const emailSent = await sendVerificationEmail(normalizedEmail, user.firstName, code);

    if (!emailSent) {
      console.log(`[DEV] Nuevo código para ${normalizedEmail}: ${code}`);
      return res.status(200).json({ 
        success: true, 
        message: 'Código generado. No se pudo enviar el correo, míralo en la consola.',
        devCode: process.env.NODE_ENV !== 'production' ? code : undefined
      });
    }

    return res.status(200).json({ success: true, message: 'Nuevo código de verificación enviado.' });

  } catch (error) {
    console.error('[AuthController] reenviarCodigo error:', error);
    return res.status(500).json({ success: false, message: 'Error interno al reenviar el código.' });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Correo y contraseña son obligatorios.' });
    }

    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
    }

    if (!user.verified) {
      return res.status(403).json({ success: false, message: 'Debes verificar tu correo antes de iniciar sesión.' });
    }

    // Crear sesión
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.firstName;

    return res.status(200).json({
      success: true,
      message: 'Sesión iniciada correctamente.',
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('[AuthController] login error:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────────────────────
function logout(req, res) {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error al cerrar sesión.' });
    }
    res.clearCookie('connect.sid');
    return res.status(200).json({ success: true, message: 'Sesión cerrada.' });
  });
}

// ─────────────────────────────────────────────────────────────
// GET /auth/me
// Retorna datos del usuario de la sesión actual
// ─────────────────────────────────────────────────────────────
function getMe(req, res) {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }
  return res.status(200).json({
    success: true,
    user: {
      id: req.session.userId,
      email: req.session.userEmail,
      firstName: req.session.userName,
    },
  });
}

module.exports = { register, verifyCode, reenviarCodigo, login, logout, getMe };
