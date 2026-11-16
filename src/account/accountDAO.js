// account/accountDAO.js
// ─────────────────────────────────────────────────────────────
// PATRÓN DAO (Acceso a datos)
// Un DAO por entidad, ambos sobre JsonDAO. El registro usa como `id` el id del
// usuario (relación 1 a 1 con users.json, que NO se modifica de forma
// estructural: solo se actualizan nombre y apellido).
// La operación común "crear o actualizar" vive en una sola clase base (DRY).
// ─────────────────────────────────────────────────────────────

const { JsonDAO } = require('../shared/persistence/JsonDAO');

/** Base abstracta: un registro por usuario, identificado por el id del usuario. */
class RegistroPorUsuarioDAO extends JsonDAO {
  /** Crea el registro si no existe o lo actualiza (merge de campos). */
  guardarOActualizar(userId, cambios) {
    return this.buscarPorId(userId)
      ? this.actualizar(userId, cambios)
      : this.guardar({ id: String(userId), ...cambios, updatedAt: new Date().toISOString() });
  }
}

/** Datos extra del perfil: teléfono, foto y preferencias de viaje (US19). */
class PerfilDAO extends RegistroPorUsuarioDAO {
  constructor() {
    super('user_profiles.json');
  }
}

/** Documento JSON de ajustes de privacidad y notificaciones (US32). */
class AjustesDAO extends RegistroPorUsuarioDAO {
  constructor() {
    super('user_settings.json');
  }
}

module.exports = { PerfilDAO, AjustesDAO };
