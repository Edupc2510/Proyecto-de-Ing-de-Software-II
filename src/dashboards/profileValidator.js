// src/dashboards/profileValidator.js
// Validación de la edición de perfil (US19).
//
// Es una función pura: no lee ni escribe archivos ni conoce a Express.
// Así se puede probar con `npm test` y reutilizar desde otros controladores.

// Campos que el usuario PUEDE editar. El correo y el DNI no están aquí a
// propósito: identifican la cuenta y no se modifican desde el perfil.
const EDITABLE_FIELDS = ['firstName', 'lastName'];

const FIELD_LABELS = {
  firstName: 'nombre',
  lastName: 'apellido',
};

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;

// Letras (con tildes y ñ), separadas por un espacio, guion o apóstrofo.
// Ejemplos válidos: "María José", "De la Cruz", "O'Connor", "Pérez-Díaz".
const NAME_PATTERN = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

/**
 * Quita espacios al inicio y al final y junta los espacios repetidos.
 * Si el valor no es texto, devuelve cadena vacía.
 */
function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Devuelve el mensaje de error de un nombre o apellido, o null si es válido.
 */
function getNameError(field, value) {
  const label = FIELD_LABELS[field];

  if (value === '') {
    return `El ${label} es obligatorio.`;
  }
  if (value.length < NAME_MIN_LENGTH) {
    return `El ${label} debe tener al menos ${NAME_MIN_LENGTH} caracteres.`;
  }
  if (value.length > NAME_MAX_LENGTH) {
    return `El ${label} no puede superar los ${NAME_MAX_LENGTH} caracteres.`;
  }
  if (!NAME_PATTERN.test(value)) {
    return `El ${label} solo puede contener letras, espacios, guiones y apóstrofos.`;
  }
  return null;
}

/**
 * Valida los datos enviados para editar el perfil.
 *
 * @param {Object} input   - Cuerpo de la petición (se ignoran los campos no editables)
 * @param {Object} current - Datos actuales del usuario: { firstName, lastName }
 * @returns {{ ok: boolean, errors?: Object, message?: string, changes?: Object }}
 *   - ok=false -> `errors` indica el mensaje de cada campo con problema.
 *   - ok=true  -> `changes` solo trae los campos que realmente cambiaron
 *                 (si está vacío, no hay nada que guardar: US19 esc. 04).
 */
function validateProfileUpdate(input, current = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const values = {};
  const errors = {};

  for (const field of EDITABLE_FIELDS) {
    values[field] = normalizeName(source[field]);
    const error = getNameError(field, values[field]);
    if (error) errors[field] = error;
  }

  if (Object.keys(errors).length > 0) {
    // Si al menos un campo está vacío se informa que faltan datos obligatorios
    const hasEmpty = EDITABLE_FIELDS.some(field => values[field] === '');
    return {
      ok: false,
      errors,
      message: hasEmpty
        ? 'Completa los campos obligatorios para guardar los cambios.'
        : 'Revisa los campos marcados.',
    };
  }

  const changes = {};
  for (const field of EDITABLE_FIELDS) {
    if (values[field] !== normalizeName(current[field])) {
      changes[field] = values[field];
    }
  }

  return { ok: true, changes };
}

module.exports = {
  EDITABLE_FIELDS,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  normalizeName,
  validateProfileUpdate,
};
