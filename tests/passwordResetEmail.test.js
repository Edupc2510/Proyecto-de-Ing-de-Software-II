const { test } = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { sendPasswordResetEmail, sendReportConfirmationEmail } = require('../src/auth/emailService');

test('US20: construye el correo con destinatario y enlace, usando TLS', async t => {
  process.env.EMAIL_USER = 'emisor@example.test';
  process.env.EMAIL_PASS = 'solo-para-test';
  let options;
  let mail;
  t.mock.method(nodemailer, 'createTransport', config => {
    options = config;
    return { on() {}, async sendMail(message) { mail = message; return { accepted: [message.to] }; } };
  });
  await sendPasswordResetEmail('prueba@example.test', 'http://localhost:3000/auth/reset-password#token=prueba');
  assert.equal(options.requireTLS, true);
  assert.equal(options.tls, undefined);
  assert.equal(mail.to, 'prueba@example.test');
  assert.match(mail.text, /15 minutos/);
  assert.match(mail.text, /#token=prueba/);
  assert.equal(mail.text.includes('solo-para-test'), false);
});
test('US36: correo contiene código; rechaza fallo SMTP o falta de configuración', async t => {
  process.env.EMAIL_USER = 'emisor@example.test';
  process.env.EMAIL_PASS = 'solo-para-test';
  let accepted = true;
  let mail;
  t.mock.method(nodemailer, 'createTransport', () => ({ on() {}, async sendMail(message) {
    mail = message; return { accepted: accepted ? [message.to] : [] };
  } }));
  await sendReportConfirmationEmail('prueba@example.test', 'REC-2026-PRUEBA');
  assert.equal(mail.to, 'prueba@example.test');
  assert.match(mail.text, /REC-2026-PRUEBA/);
  assert.match(mail.text, /Registrado/);
  assert.equal(mail.text.includes('solo-para-test'), false);
  accepted = false;
  await assert.rejects(sendReportConfirmationEmail('prueba@example.test', 'REC'), /no aceptado/);
  delete process.env.EMAIL_PASS;
  await assert.rejects(sendReportConfirmationEmail('prueba@example.test', 'REC'), /sin configurar/);
});
