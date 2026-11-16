// shared/jsonStore.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ADAPTER (estructural)
// ─────────────────────────────────────────────────────────────
// Los modelos de reservas, notificaciones, rutas habituales, calificaciones,
// strikes y conductores favoritos usan una interfaz simple { read, write }.
// El equipo adoptó después una fuente de datos única, JsonDataSource
// (patrón Singleton), con otra interfaz: leerColeccion() / escribirColeccion().
//
// Este adaptador traduce una interfaz a la otra. Así todos los modelos
// comparten el mismo punto de acceso a /data que los DAO del grupo, sin
// reescribir cada modelo.
//
// - Inversión de dependencias (D): los modelos dependen de { read, write },
//   no del sistema de archivos.
// - Si mañana se cambia JsonDataSource por una base de datos, los modelos
//   no cambian.
// ─────────────────────────────────────────────────────────────

const { JsonDataSource } = require('./persistence/JsonDataSource');

/**
 * Crea un "store" para un archivo JSON que contiene un array.
 * Si el archivo no existe, la fuente de datos lo crea vacío automáticamente.
 * @param {string} fileName - Nombre del archivo dentro de /data (ej: 'bookings.json')
 * @returns {{ read: () => Array, write: (items: Array) => boolean }}
 */
function createJsonStore(fileName) {
  // Se pide la instancia en cada operación: respeta la carpeta configurada
  // (MOVESHARE_DATA_DIR) y el reinicio de la instancia en las pruebas.
  const source = () => JsonDataSource.getInstancia();

  return {
    read: () => source().leerColeccion(fileName),
    write: (items) => source().escribirColeccion(fileName, items),
  };
}

module.exports = { createJsonStore };
