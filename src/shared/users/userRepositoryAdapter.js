// shared/users/userRepositoryAdapter.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: el módulo de usuarios existente (auth/userModel.js) expone
// FUNCIONES sueltas (findUserById, updateUser, readUsers) que además leen el
// JSON directamente. Los servicios nuevos (cuenta, calificaciones) no deben
// depender de ese formato ni de esa ruta fija de archivo (DIP).
//
// Solución: este adaptador implementa la interfaz que esperan los servicios
// ("Target" = RepositorioUsuarios) y traduce cada llamada a userModel
// (Adaptee) SIN modificar su código.
//
//   Cliente  -> AccountFacade / CalificacionService
//   Target   -> RepositorioUsuarios { buscarPorId, existe, actualizar, listar }
//   Adapter  -> UsuarioRepositorioAdapter
//   Adaptee  -> src/auth/userModel.js
// ─────────────────────────────────────────────────────────────

class UsuarioRepositorioAdapter {
  /**
   * @param {object} [userModel] - módulo auth/userModel (inyectable en pruebas)
   */
  constructor(userModel = require('../../auth/userModel')) {
    this.userModel = userModel;
  }

  buscarPorId(id) {
    if (id === undefined || id === null || id === '') return null;
    return this.userModel.findUserById(String(id));
  }

  existe(id) {
    return this.buscarPorId(id) !== null;
  }

  actualizar(id, cambios) {
    return this.userModel.updateUser(String(id), cambios);
  }

  listar() {
    return this.userModel.readUsers();
  }
}

module.exports = { UsuarioRepositorioAdapter };
