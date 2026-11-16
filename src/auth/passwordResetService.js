const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const userModel = require('./userModel');
const { sendPasswordResetEmail } = require('./emailService');

const RESET_TTL_MS = 15 * 60 * 1000;
const REQUEST_INTERVAL_MS = 60 * 1000;
const REQUEST_MESSAGE = 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.';

class RecoveryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Reglas de US20. Recibe colaboradores para probar sin enviar correos reales. */
class PasswordResetService {
  constructor({ users = userModel, sendEmail = sendPasswordResetEmail, now = Date.now,
    baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000' } = {}) {
    this.users = users;
    this.sendEmail = sendEmail;
    this.now = now;
    this.baseUrl = new URL(baseUrl);
    if (!['http:', 'https:'].includes(this.baseUrl.protocol)) throw new Error('APP_BASE_URL debe ser una URL HTTP o HTTPS.');
    // El almacén guarda el hash del token, nunca el enlace completo.
    this.pending = new Map();
  }

  async requestReset(email) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
      throw new RecoveryError('Ingresa un correo electrónico válido.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    const now = this.now();
    for (const [key, entry] of this.pending) {
      if (entry.expiresAt <= now) this.pending.delete(key);
    }
    const user = this.users.findUserByEmail(normalizedEmail);
    if (!user) return REQUEST_MESSAGE;
    for (const [key, entry] of this.pending) {
      if (entry.userId !== user.id) continue;
      if (now - entry.createdAt < REQUEST_INTERVAL_MS) return REQUEST_MESSAGE;
      this.pending.delete(key);
    }
    const token = crypto.randomBytes(32).toString('hex');
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    this.pending.set(digest, { userId: user.id, createdAt: now, expiresAt: now + RESET_TTL_MS, busy: false });
    const url = new URL('/auth/reset-password', this.baseUrl);
    // El fragmento no se transmite al servidor al abrir la página.
    url.hash = `token=${token}`;
    try {
      await this.sendEmail(user.email, url.toString());
    } catch {
      this.pending.delete(digest);
      console.error('[US20] No se pudo enviar un correo de recuperación. Revisar la configuración SMTP.');
    }
    return REQUEST_MESSAGE;
  }

  async resetPassword(token, password, confirmation) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      throw new RecoveryError('El enlace no es válido. Solicita uno nuevo.');
    }
    if (typeof password !== 'string' || password.trim().length < 6 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new RecoveryError('Usa al menos 6 caracteres y como máximo 72 bytes en la contraseña.');
    }
    if (password !== confirmation) throw new RecoveryError('Las contraseñas no coinciden.');
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    const entry = this.pending.get(digest);
    if (!entry || entry.expiresAt <= this.now()) {
      this.pending.delete(digest);
      throw new RecoveryError('El enlace venció o ya fue utilizado. Solicita uno nuevo.');
    }
    if (entry.busy) throw new RecoveryError('El cambio ya se está procesando.', 409);
    entry.busy = true;
    try {
      const hash = await bcrypt.hash(password, 10);
      // Durante el cálculo asíncrono pudo vencer o reemplazarse el enlace.
      if (this.pending.get(digest) !== entry || entry.expiresAt <= this.now()) {
        throw new RecoveryError('El enlace venció o fue reemplazado. Solicita uno nuevo.');
      }
      const user = this.users.findUserById(entry.userId);
      if (!user) throw new RecoveryError('La cuenta ya no está disponible.');
      const saved = this.users.updateUser(user.id, {
        password: hash,
        passwordVersion: (user.passwordVersion || 0) + 1,
      });
      if (!saved) throw new Error('No se pudo actualizar la contraseña.');
      this.pending.delete(digest);
      return 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.';
    } finally {
      entry.busy = false;
    }
  }
}

module.exports = { PasswordResetService, RecoveryError, RESET_TTL_MS, REQUEST_MESSAGE };
