// claims/claimModel.js
// Modelo de dominio de un Reclamo (US37 - Consultar estado del reclamo).

const { v4: uuidv4 } = require('uuid');

const CLAIM_STATUS = Object.freeze({
  REGISTERED: 'registrado',
  IN_REVIEW: 'en_revision',
  IN_PROGRESS: 'en_proceso',
  RESOLVED: 'resuelto',
  REJECTED: 'rechazado',
  CLOSED: 'cerrado',
});

/** Catálogo de presentación de cada estado (paso = avance en la línea de tiempo 1..4) */
const CATALOGO_ESTADOS = Object.freeze({
  [CLAIM_STATUS.REGISTERED]: { etiqueta: 'Registrado', tono: 'info', paso: 1, final: false, descripcion: 'Recibimos tu reclamo y está en cola de atención.' },
  [CLAIM_STATUS.IN_REVIEW]: { etiqueta: 'En revisión', tono: 'warning', paso: 2, final: false, descripcion: 'Un agente de soporte está revisando tu caso.' },
  [CLAIM_STATUS.IN_PROGRESS]: { etiqueta: 'En proceso', tono: 'warning', paso: 3, final: false, descripcion: 'Estamos aplicando una solución o contactando a las partes involucradas.' },
  [CLAIM_STATUS.RESOLVED]: { etiqueta: 'Resuelto', tono: 'success', paso: 4, final: true, descripcion: 'Tu reclamo fue atendido. Revisa la respuesta de soporte.' },
  [CLAIM_STATUS.REJECTED]: { etiqueta: 'No procedente', tono: 'error', paso: 4, final: true, descripcion: 'Tu reclamo fue evaluado y no procede. Revisa el motivo.' },
  [CLAIM_STATUS.CLOSED]: { etiqueta: 'Cerrado', tono: 'neutral', paso: 4, final: true, descripcion: 'El caso fue cerrado.' },
});

const PASOS_LINEA_TIEMPO = ['Registrado', 'En revisión', 'En proceso', 'Respuesta'];

const CATEGORIAS = Object.freeze({
  seguridad: { etiqueta: 'Seguridad en el viaje', prioridad: 'alta' },
  conducta: { etiqueta: 'Conducta del conductor', prioridad: 'alta' },
  cobro: { etiqueta: 'Cobro o pago', prioridad: 'media' },
  objeto_perdido: { etiqueta: 'Objeto perdido', prioridad: 'media' },
  ruta: { etiqueta: 'Cambio de ruta u horario', prioridad: 'baja' },
  aplicacion: { etiqueta: 'Problema con la aplicación', prioridad: 'baja' },
});

/** Tiempo máximo de respuesta (SLA) según prioridad, en horas */
const SLA_HORAS = Object.freeze({ alta: 24, media: 72, baja: 120 });

function crearReclamo({ code, passengerId, reservationId = null, category, subject, description, demo = false }) {
  const ahora = new Date().toISOString();
  const categoria = CATEGORIAS[category] ? category : 'aplicacion';
  return {
    id: uuidv4(),
    code,
    passengerId: String(passengerId),
    reservationId,
    category: categoria,
    priority: CATEGORIAS[categoria].prioridad,
    subject: String(subject || '').trim(),
    description: String(description || '').trim(),
    status: CLAIM_STATUS.REGISTERED,
    assignedAgent: null,
    response: null,
    history: [{ status: CLAIM_STATUS.REGISTERED, at: ahora, note: 'Reclamo registrado.' }],
    createdAt: ahora,
    updatedAt: ahora,
    demo: Boolean(demo),
  };
}

module.exports = { CLAIM_STATUS, CATALOGO_ESTADOS, PASOS_LINEA_TIEMPO, CATEGORIAS, SLA_HORAS, crearReclamo };
