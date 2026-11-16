// shared/persistence/JsonDAO.js
// ─────────────────────────────────────────────────────────────
// PATRÓN DAO (Data Access Object)
// ─────────────────────────────────────────────────────────────
// Clase base que encapsula las operaciones de acceso a datos (CRUD) sobre una
// colección JSON. Los servicios (lógica de negocio) NUNCA leen ni escriben
// archivos directamente: solo llaman a guardar(), buscarPorId(), listar(),
// actualizar() o eliminar().
//
// Cada entidad tiene su DAO concreto (SolicitudDAO, ReservaDAO, ReclamoDAO...)
// que hereda de esta clase y agrega consultas propias de su dominio.
// Si mañana se migra a PostgreSQL/MySQL, solo cambian los DAO concretos.
// ─────────────────────────────────────────────────────────────

const { JsonDataSource } = require('./JsonDataSource');

class JsonDAO {
  /**
   * @param {string} nombreArchivo - Archivo dentro de /data (ej: 'trip_requests.json')
   */
  constructor(nombreArchivo) {
    if (new.target === JsonDAO) {
      throw new Error('JsonDAO es abstracto: crea un DAO concreto por entidad.');
    }
    this.nombreArchivo = nombreArchivo;
    this.dataSource = JsonDataSource.getInstancia();
  }

  listar() {
    return this.dataSource.leerColeccion(this.nombreArchivo);
  }

  buscar(predicado) {
    return this.listar().filter(predicado);
  }

  buscarPorId(id) {
    return this.listar().find(item => String(item.id) === String(id)) || null;
  }

  guardar(entidad) {
    const items = this.listar();
    items.push(entidad);
    this.#persistir(items);
    return entidad;
  }

  actualizar(id, cambios) {
    const items = this.listar();
    const index = items.findIndex(item => String(item.id) === String(id));
    if (index === -1) return null;
    items[index] = { ...items[index], updatedAt: new Date().toISOString(), ...cambios };
    this.#persistir(items);
    return items[index];
  }

  eliminar(id) {
    const items = this.listar();
    const restantes = items.filter(item => String(item.id) !== String(id));
    if (restantes.length === items.length) return false;
    this.#persistir(restantes);
    return true;
  }

  eliminarDonde(predicado) {
    const items = this.listar();
    const restantes = items.filter(item => !predicado(item));
    this.#persistir(restantes);
    return items.length - restantes.length;
  }

  #persistir(items) {
    if (!this.dataSource.escribirColeccion(this.nombreArchivo, items)) {
      throw new Error(`No se pudo guardar la información en ${this.nombreArchivo}.`);
    }
  }
}

module.exports = { JsonDAO };
