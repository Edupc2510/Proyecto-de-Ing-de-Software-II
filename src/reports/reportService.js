const { randomUUID } = require('node:crypto');
const { ReportRepository } = require('./reportRepository');
const { TripAccessRepository } = require('../trips/tripAccessRepository');
const { sendReportConfirmationEmail } = require('../auth/emailService');

const CATEGORIES = Object.freeze({ seguridad: 'alta', conducta: 'alta', cobro: 'media',
  objeto_perdido: 'media', ruta: 'baja', aplicacion: 'baja' });
class ReportError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Caja blanca: 9 decisiones sencillas + 1 = complejidad ciclomática 10.
function validateReportInput(input = {}) {
  if (typeof input.routeId !== 'string') throw new ReportError('Selecciona un viaje.');
  if (!input.routeId.trim()) throw new ReportError('Selecciona un viaje.');
  if (typeof input.category !== 'string') throw new ReportError('Selecciona un motivo válido.');
  if (!Object.hasOwn(CATEGORIES, input.category)) throw new ReportError('Selecciona un motivo válido.');
  if (typeof input.description !== 'string') throw new ReportError('Escribe la descripción del reclamo.');
  if (!input.description.trim()) throw new ReportError('Escribe la descripción del reclamo.');
  if (input.description.trim().length > 1000) throw new ReportError('La descripción puede tener hasta 1000 caracteres.');
  if (typeof input.requestId !== 'string') throw new ReportError('Actualiza la página antes de enviar el reclamo.');
  if (!/^[a-f0-9-]{36}$/i.test(input.requestId)) throw new ReportError('Actualiza la página antes de enviar el reclamo.');
  return { routeId: input.routeId.trim(), category: input.category,
    description: input.description.trim(), requestId: input.requestId };
}

/** Fachada (Facade): registrar = validar, comprobar el viaje, guardar, avisar.
 * Las dependencias se reciben para probar sin correos ni archivos reales (DIP).
 */
class ReportService {
  constructor({ reports = new ReportRepository(), trips = new TripAccessRepository(),
    sendEmail = sendReportConfirmationEmail, now = () => new Date() } = {}) {
    Object.assign(this, { reports, trips, sendEmail, now });
  }
  async register(user, input) {
    const data = validateReportInput(input);
    const previous = this.reports.findRequest(user.id, data.requestId);
    if (previous) return this.result(previous);
    const trip = this.trips.getForUser(user.id).find(row => row.routeId === data.routeId);
    if (!trip) throw new ReportError('Solo puedes reportar viajes en los que participas.', 403);
    const timestamp = this.now().toISOString();
    const id = randomUUID();
    const report = {
      id, code: `REC-${timestamp.slice(0, 4)}-${id.toUpperCase()}`,
      // Nombre conservado por compatibilidad con US37; puede identificar al conductor.
      passengerId: String(user.id), reporterRole: trip.role,
      routeId: trip.routeId, reservationId: trip.reservationId,
      routeSnapshot: { origin: trip.origin, dest: trip.dest, time: trip.time },
      category: data.category, priority: CATEGORIES[data.category],
      subject: `Incidencia de viaje: ${data.category}`, description: data.description,
      status: 'registrado', assignedAgent: null, response: null,
      history: [{ status: 'registrado', at: timestamp, note: 'Reclamo registrado.' }],
      createdAt: timestamp, updatedAt: timestamp, demo: false,
      requestId: data.requestId, emailStatus: 'pendiente',
    };
    // Se guarda ANTES del correo. Un fallo de SMTP no pierde el reclamo.
    this.reports.save(report);
    try {
      await this.sendEmail(user.email, report.code);
      report.emailStatus = 'enviado';
    } catch {
      report.emailStatus = 'fallido';
    }
    try { this.reports.save(report); }
    catch { report.emailStatus = 'pendiente'; }
    return this.result(report);
  }
  result(report) {
    const emailSent = report.emailStatus === 'enviado';
    return { code: report.code, status: report.status, emailSent,
      message: emailSent ? 'Reclamo registrado. Enviamos la confirmación a tu correo.'
        : 'Reclamo registrado. No pudimos confirmar el envío del correo; guarda tu código.' };
  }
}
module.exports = { ReportService, ReportError, validateReportInput };
