// account/accountFacade.js
// ─────────────────────────────────────────────────────────────
// PATRÓN FACADE (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: editar el perfil (US19) y gestionar la cuenta (US32) involucra
// varios subsistemas: el repositorio de usuarios (nombre y apellido), el DAO
// de perfil (teléfono, foto, preferencias), el DAO de ajustes y el validador.
// Si el controlador los coordinara, conocería todos esos detalles (viola la
// Ley de Demeter) y cada cambio lo obligaría a modificarse.
//
// Solución: AccountFacade ofrece una interfaz simple de alto nivel
// (obtenerPerfil, actualizarPerfil, obtenerAjustes, actualizarAjustes,
// perfilPublico...) y coordina internamente a los subsistemas. El controlador
// solo habla con la fachada.
//
// También implementa las políticas que consultan otros módulos (DIP):
//   estaVisible(driverId)          -> catálogo de viajes (cuenta pausada)
//   puedeRecibirSolicitudes(id)    -> módulo de solicitudes (cuenta pausada)
//   puedeNotificar(id, tipo)       -> módulo de notificaciones
// ─────────────────────────────────────────────────────────────

const { DomainError } = require('../shared/httpHelpers');
const { UsuarioRepositorioAdapter } = require('../shared/users/userRepositoryAdapter');
const { PerfilDAO, AjustesDAO } = require('./accountDAO');
const { ValidadorPerfil, ErrorValidacion } = require('./profileValidators');
const {
  AJUSTES, CLAVES_AJUSTES, ajustesPorDefecto, preferenciasPorDefecto,
} = require('./settingsModel');

const CAMPOS_DE_USUARIO = ['firstName', 'lastName'];          // viven en users.json
const CAMPOS_DE_PERFIL = ['phone', 'photo', 'preferencias'];  // viven en user_profiles.json

const MENSAJE_SIN_CAMBIOS = 'No hay cambios para guardar.';

class AccountFacade {
  /**
   * @param {{ usuarios: object, perfiles: object, ajustes: object, validador?: ValidadorPerfil }} deps
   */
  constructor({ usuarios, perfiles, ajustes, validador = new ValidadorPerfil() }) {
    this.usuarios = usuarios;
    this.perfiles = perfiles;
    this.ajustes = ajustes;
    this.validador = validador;
  }

  static crearPorDefecto() {
    return new AccountFacade({
      usuarios: new UsuarioRepositorioAdapter(),
      perfiles: new PerfilDAO(),
      ajustes: new AjustesDAO(),
    });
  }

  // ───────────────────── US19 · Perfil ─────────────────────

  obtenerPerfil(userId) {
    const usuario = this.#usuarioObligatorio(userId);
    const extra = this.perfiles.buscarPorId(userId) || {};
    return {
      id: usuario.id,
      firstName: usuario.firstName,
      lastName: usuario.lastName,
      email: usuario.email,
      dni: usuario.dni,
      createdAt: usuario.createdAt,
      phone: extra.phone || '',
      photo: extra.photo || null,
      preferencias: { ...preferenciasPorDefecto(), ...(extra.preferencias || {}) },
    };
  }

  /**
   * Actualización parcial del perfil. Solo se permiten los campos editables;
   * email y DNI no se pueden cambiar desde aquí.
   * @returns {{ actualizado: boolean, mensaje: string, perfil: object }}
   * @throws {ErrorValidacion} si algún campo es vacío o inválido (no guarda nada)
   */
  actualizarPerfil(userId, datos = {}) {
    const actual = this.obtenerPerfil(userId);
    const entrada = this.#normalizar(datos);

    this.validador.validar(entrada);

    const cambios = this.#soloLoQueCambio(actual, entrada);
    if (Object.keys(cambios).length === 0) {
      return { actualizado: false, mensaje: MENSAJE_SIN_CAMBIOS, perfil: actual };
    }

    const cambiosPerfil = this.#extraer(cambios, CAMPOS_DE_PERFIL);
    const cambiosUsuario = this.#extraer(cambios, CAMPOS_DE_USUARIO);

    if (Object.keys(cambiosPerfil).length > 0) this.perfiles.guardarOActualizar(userId, cambiosPerfil);
    if (Object.keys(cambiosUsuario).length > 0) this.usuarios.actualizar(userId, cambiosUsuario);

    return { actualizado: true, mensaje: 'Perfil actualizado correctamente.', perfil: this.obtenerPerfil(userId) };
  }

  // ───────────────────── US32 · Ajustes ─────────────────────

  obtenerAjustes(userId) {
    this.#usuarioObligatorio(userId);
    const guardados = this.ajustes.buscarPorId(userId) || {};
    return Object.fromEntries(
      CLAVES_AJUSTES.map(clave => [clave, typeof guardados[clave] === 'boolean' ? guardados[clave] : AJUSTES[clave].porDefecto])
    );
  }

  /**
   * Actualización parcial de ajustes: { showPhone: false, ... }.
   * @returns {{ actualizado: boolean, mensaje: string, ajustes: object }}
   */
  actualizarAjustes(userId, cambios = {}) {
    const actuales = this.obtenerAjustes(userId);
    const errores = {};

    for (const [clave, valor] of Object.entries(cambios)) {
      if (!CLAVES_AJUSTES.includes(clave)) errores[clave] = { codigo: 'AJUSTE_DESCONOCIDO', mensaje: `Ajuste desconocido: ${clave}.` };
      else if (typeof valor !== 'boolean') errores[clave] = { codigo: 'CAMPO_INVALIDO', mensaje: `El ajuste ${clave} debe ser verdadero o falso.` };
    }
    if (Object.keys(errores).length > 0) throw new ErrorValidacion(errores);

    const modificados = Object.fromEntries(Object.entries(cambios).filter(([clave, valor]) => actuales[clave] !== valor));
    if (Object.keys(modificados).length === 0) {
      return { actualizado: false, mensaje: MENSAJE_SIN_CAMBIOS, ajustes: actuales };
    }

    this.ajustes.guardarOActualizar(userId, modificados);
    return { actualizado: true, mensaje: 'Preferencias actualizadas.', ajustes: this.obtenerAjustes(userId) };
  }

  /**
   * Perfil que ven los demás usuarios. Una cuenta pausada no aparece (null) y
   * el teléfono solo se muestra si el usuario lo permite; si no, la
   * comunicación es únicamente por el chat interno.
   */
  perfilPublico(userId) {
    const usuario = this.usuarios.buscarPorId(userId);
    if (!usuario) return null;
    const ajustes = this.obtenerAjustes(userId);
    if (ajustes.accountPaused) return null;

    const extra = this.perfiles.buscarPorId(userId) || {};
    const muestraTelefono = ajustes.showPhone && Boolean(extra.phone);
    return {
      id: usuario.id,
      firstName: usuario.firstName,
      lastName: usuario.lastName,
      photo: extra.photo || null,
      phone: muestraTelefono ? extra.phone : null,
      canalesContacto: muestraTelefono ? ['telefono', 'chat_interno'] : ['chat_interno'],
    };
  }

  // ───────────── Políticas que consumen otros módulos ─────────────

  /** ¿Los viajes de este conductor aparecen en las búsquedas? */
  estaVisible(userId) {
    if (!userId) return true; // ruta antigua sin conductor asociado
    return !this.#ajustesSeguros(userId).accountPaused;
  }

  puedeRecibirSolicitudes(userId) {
    return !this.#ajustesSeguros(userId).accountPaused;
  }

  /** @param {'coincidenciaRuta'} tipo */
  puedeNotificar(userId, tipo = 'coincidenciaRuta') {
    const ajustes = this.#ajustesSeguros(userId);
    return tipo === 'coincidenciaRuta' ? ajustes.pushNotifications && !ajustes.accountPaused : false;
  }

  // ───────────────────── Internos ─────────────────────

  #usuarioObligatorio(userId) {
    const usuario = this.usuarios.buscarPorId(userId);
    if (!usuario) throw new DomainError('Usuario no encontrado.', 404);
    return usuario;
  }

  /** Ajustes sin exigir que el usuario exista (las políticas no deben romper el catálogo). */
  #ajustesSeguros(userId) {
    const guardados = this.ajustes.buscarPorId(userId) || {};
    return { ...ajustesPorDefecto(), ...Object.fromEntries(Object.entries(guardados).filter(([k]) => CLAVES_AJUSTES.includes(k))) };
  }

  /** Recorta textos y se queda solo con los campos editables. */
  #normalizar(datos) {
    const entrada = {};
    for (const campo of this.validador.camposEditables) {
      if (!Object.prototype.hasOwnProperty.call(datos, campo)) continue;
      const valor = datos[campo];
      entrada[campo] = typeof valor === 'string' && campo !== 'photo' ? valor.trim() : valor;
    }
    if (typeof entrada.phone === 'string') entrada.phone = entrada.phone.replace(/[\s-]/g, '').replace(/^\+51/, '');
    return entrada;
  }

  #soloLoQueCambio(actual, entrada) {
    const cambios = {};
    for (const [campo, valor] of Object.entries(entrada)) {
      const nuevo = campo === 'preferencias' ? { ...actual.preferencias, ...valor } : (campo === 'photo' && valor === '' ? null : valor);
      if (JSON.stringify(nuevo) !== JSON.stringify(actual[campo])) cambios[campo] = nuevo;
    }
    return cambios;
  }

  #extraer(objeto, campos) {
    return Object.fromEntries(Object.entries(objeto).filter(([campo]) => campos.includes(campo)));
  }
}

module.exports = { AccountFacade, MENSAJE_SIN_CAMBIOS };
