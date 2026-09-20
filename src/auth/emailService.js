// models/emailService.js
// Servicio de envío de correos usando Nodemailer con Gmail

const nodemailer = require('nodemailer');

function createTransporter() {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,             // Cambiamos al puerto de TLS adaptable
    secure: false,         // Debe ser false para el puerto 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Evita caídas por bloqueos de certificados
      ciphers: 'SSLv3'           // Fuerza compatibilidad estable de cifrado
    },
    connectionTimeout: 10000, // Si en 10 segundos no conecta, aborta (evita que el server se congele)
    greetingTimeout: 5000,
    socketTimeout: 15000
  });

  transporter.on('error', (err) => {
    console.error('[Nodemailer Transporter Error]:', err.message);
  });

  return transporter;
}

/**
 * Envía un correo de verificación con el código de 6 dígitos.
 * @param {string} toEmail - Correo destino
 * @param {string} userName - Nombre del usuario para personalizar el correo
 * @param {string} code - Código de 6 dígitos generado
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function sendVerificationEmail(toEmail, userName, code) {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"MoveShare 🚗" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'MoveShare – Verifica tu cuenta',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
            .container { max-width: 500px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #1A237E, #2979FF); padding: 32px; text-align: center; }
            .header h1 { color: #fff; margin: 0; font-size: 28px; letter-spacing: 1px; }
            .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; }
            .body { padding: 32px; }
            .body p { color: #444; line-height: 1.6; }
            .code-box { background: #f0f4ff; border: 2px dashed #2979FF; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
            .code { font-size: 40px; font-weight: bold; color: #1A237E; letter-spacing: 8px; }
            .footer { background: #f5f5f5; padding: 16px; text-align: center; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MoveShare</h1>
              <p>Movilidad compartida universitaria</p>
            </div>
            <div class="body">
              <p>Hola, <strong>${userName}</strong> 👋</p>
              <p>Gracias por registrarte en MoveShare. Para completar tu registro, ingresa el siguiente código de verificación en la plataforma:</p>
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              <p>Este código es válido por <strong>15 minutos</strong>.</p>
              <p>Si no creaste una cuenta en MoveShare, puedes ignorar este correo.</p>
            </div>
            <div class="footer">
              © 2024 MoveShare · Lima, Perú
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('[EmailService] Error enviando correo:', error.message);
    return false;
  }
}

module.exports = { sendVerificationEmail };