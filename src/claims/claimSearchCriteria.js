// claims/claimSearchCriteria.js
// Validación de los 5 campos de búsqueda de reclamos (US37):
//   código, estado, categoría, fecha desde y fecha hasta.
// Todos son opcionales; si se envían, deben ser válidos.

const { CATALOGO_ESTADOS, CATEGORIAS } = require('./claimModel');
const { DomainError } = require('../shared/httpHelpers');

const FORMATO_CODIGO = /^REC-\d{4}-\d{6}$/;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const vacio = v => v === undefined || v === null || String(v).trim() === '';

/**
 * Convierte "AAAA-MM-DD" en una fecha local. Devuelve null si no es una fecha real
 * (por ejemplo 2026-02-30).
 */
function parsearFecha(texto, finDelDia = false) {
  if (!FORMATO_FECHA.test(texto)) return null;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const fecha = finDelDia ? new Date(anio, mes - 1, dia, 23, 59, 59, 999) : new Date(anio, mes - 1, dia, 0, 0, 0, 0);
  const esReal = fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
  return esReal ? fecha : null;
}

/**
 * Valida y normaliza los criterios de búsqueda.
 * @param {{ codigo?, estado?, categoria?, desde?, hasta? }} entrada
 * @param {Date} [hoy]
 * @returns {{ codigo: string|null, estado: string|null, categoria: string|null, desde: Date|null, hasta: Date|null }}
 * @throws {DomainError} con un mensaje que indica el campo inválido
 */
function validarCriteriosBusqueda(entrada = {}, hoy = new Date()) {
  const criterios = { codigo: null, estado: null, categoria: null, desde: null, hasta: null };

  if (!vacio(entrada.codigo)) {
    const codigo = String(entrada.codigo).trim().toUpperCase();
    if (!FORMATO_CODIGO.test(codigo)) {
      throw new DomainError('Código: debe tener el formato REC-AAAA-NNNNNN (ej. REC-2026-000001).');
    }
    criterios.codigo = codigo;
  }

  if (!vacio(entrada.estado) && entrada.estado !== 'todos') {
    if (!CATALOGO_ESTADOS[entrada.estado]) throw new DomainError('Estado: el valor seleccionado no es válido.');
    criterios.estado = entrada.estado;
  }

  if (!vacio(entrada.categoria) && entrada.categoria !== 'todas') {
    if (!CATEGORIAS[entrada.categoria]) throw new DomainError('Categoría: el valor seleccionado no es válido.');
    criterios.categoria = entrada.categoria;
  }

  const finDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

  if (!vacio(entrada.desde)) {
    criterios.desde = parsearFecha(String(entrada.desde).trim());
    if (!criterios.desde) throw new DomainError('Fecha desde: no es una fecha válida (AAAA-MM-DD).');
    if (criterios.desde > finDeHoy) throw new DomainError('Fecha desde: no puede ser una fecha futura.');
  }

  if (!vacio(entrada.hasta)) {
    criterios.hasta = parsearFecha(String(entrada.hasta).trim(), true);
    if (!criterios.hasta) throw new DomainError('Fecha hasta: no es una fecha válida (AAAA-MM-DD).');
  }

  if (criterios.desde && criterios.hasta && criterios.desde > criterios.hasta) {
    throw new DomainError('Rango de fechas: la fecha desde no puede ser posterior a la fecha hasta.');
  }

  return criterios;
}

/** Indica si un reclamo cumple los criterios ya validados. */
function cumpleCriterios(reclamo, criterios) {
  const creado = new Date(reclamo.createdAt);
  return (!criterios.codigo || reclamo.code === criterios.codigo)
    && (!criterios.estado || reclamo.status === criterios.estado)
    && (!criterios.categoria || reclamo.category === criterios.categoria)
    && (!criterios.desde || creado >= criterios.desde)
    && (!criterios.hasta || creado <= criterios.hasta);
}

module.exports = { validarCriteriosBusqueda, cumpleCriterios };
