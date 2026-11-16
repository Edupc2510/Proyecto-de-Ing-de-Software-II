// account/profileValidators.js
// ─────────────────────────────────────────────────────────────
// Reglas de validación del perfil (US19).
//
// Cada regla es un objeto con validar(valor) -> mensaje | null (duck typing:
// el validador solo necesita ese método). Hay UNA regla por campo y el
// ValidadorPerfil las recorre; agregar un campo nuevo = agregar una regla,
// sin tocar el resto (SRP + OCP).
//
// Distingue los dos escenarios de la HU:
//   - campo obligatorio vacío -> codigo 'CAMPO_VACIO'    (escenario 03)
//   - valor con formato malo  -> codigo 'CAMPO_INVALIDO' (escenario 02)
// ─────────────────────────────────────────────────────────────

const { DomainError } = require('../shared/httpHelpers');
const { OPCIONES_PREFERENCIA, CLAVES_PREFERENCIAS } = require('./settingsModel');

/** Error de validación con el detalle por campo. */
class ErrorValidacion extends DomainError {
  /** @param {Object<string,{codigo:string,mensaje:string}>} errores */
  constructor(errores) {
    super('Revisa los campos marcados.', 422);
    this.name = 'ErrorValidacion';
    this.errores = errores;
  }
}

const vacio = valor => valor === undefined || valor === null || String(valor).trim() === '';
const error = (codigo, mensaje) => ({ codigo, mensaje });

class ReglaNombre {
  constructor(etiqueta) { this.etiqueta = etiqueta; }
  validar(valor) {
    if (vacio(valor)) return error('CAMPO_VACIO', `${this.etiqueta} es obligatorio.`);
    const texto = String(valor).trim();
    if (texto.length < 2 || texto.length > 40) {
      return error('CAMPO_INVALIDO', `${this.etiqueta} debe tener entre 2 y 40 caracteres.`);
    }
    if (!/^[\p{L}][\p{L}\s'’-]*$/u.test(texto)) {
      return error('CAMPO_INVALIDO', `${this.etiqueta} solo puede contener letras, espacios, guion o apóstrofo.`);
    }
    return null;
  }
}

/** Celular peruano de 9 dígitos que empieza en 9. Es opcional. */
class ReglaTelefono {
  validar(valor) {
    if (vacio(valor)) return null;
    const limpio = String(valor).replace(/[\s-]/g, '').replace(/^\+51/, '');
    return /^9\d{8}$/.test(limpio)
      ? null
      : error('CAMPO_INVALIDO', 'El teléfono debe ser un celular de 9 dígitos que empiece con 9.');
  }
}

/**
 * Foto de perfil como data URL (png, jpeg o webp). El frontend la reduce antes
 * de enviarla; el servidor solo exige un tamaño razonable (límite de body 100 kb).
 */
const MAX_LONGITUD_FOTO = 90000;
class ReglaFoto {
  validar(valor) {
    if (valor === null || valor === '') return null; // quitar foto
    if (typeof valor !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) {
      return error('CAMPO_INVALIDO', 'La foto debe ser una imagen PNG, JPG o WEBP.');
    }
    if (valor.length > MAX_LONGITUD_FOTO) {
      return error('CAMPO_INVALIDO', 'La foto es demasiado pesada. Usa una imagen más pequeña.');
    }
    return null;
  }
}

class ReglaPreferencias {
  validar(valor) {
    if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
      return error('CAMPO_INVALIDO', 'Las preferencias de viaje no tienen un formato válido.');
    }
    for (const [clave, opcion] of Object.entries(valor)) {
      if (!CLAVES_PREFERENCIAS.includes(clave) || !OPCIONES_PREFERENCIA.includes(opcion)) {
        return error('CAMPO_INVALIDO', `Preferencia no válida: ${clave}.`);
      }
    }
    return null;
  }
}

class ValidadorPerfil {
  constructor(reglas = ValidadorPerfil.reglasPorDefecto()) {
    this.reglas = reglas;
  }

  static reglasPorDefecto() {
    return {
      firstName: new ReglaNombre('El nombre'),
      lastName: new ReglaNombre('El apellido'),
      phone: new ReglaTelefono(),
      photo: new ReglaFoto(),
      preferencias: new ReglaPreferencias(),
    };
  }

  get camposEditables() { return Object.keys(this.reglas); }

  /**
   * Valida solo los campos presentes en `datos` (actualización parcial).
   * @throws {ErrorValidacion}
   */
  validar(datos) {
    const errores = {};
    for (const campo of this.camposEditables) {
      if (!Object.prototype.hasOwnProperty.call(datos, campo)) continue;
      const problema = this.reglas[campo].validar(datos[campo]);
      if (problema) errores[campo] = problema;
    }
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);
  }
}

module.exports = { ValidadorPerfil, ErrorValidacion, ReglaNombre, ReglaTelefono, ReglaFoto, ReglaPreferencias };
