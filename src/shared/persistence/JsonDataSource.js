// shared/persistence/JsonDataSource.js
// ─────────────────────────────────────────────────────────────
// PATRÓN SINGLETON (Creacional)
// ─────────────────────────────────────────────────────────────
// Representa la "fuente de datos" de MoveShare: la carpeta /data con
// archivos JSON. Debe existir UNA sola instancia que administre la lectura y
// escritura de los archivos, para que todos los DAO compartan el mismo punto
// de acceso (igual que el GeneradorNumeroComprobante del ejemplo de clase).
//
// - El constructor no debe usarse directamente: se lanza un error si ya existe
//   una instancia.
// - getInstancia() crea la instancia la primera vez y luego siempre devuelve
//   la misma.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_DIR = path.join(__dirname, '../../../data');

class JsonDataSource {
  static #instanciaUnica = null;

  constructor(dataDir = DEFAULT_DATA_DIR) {
    if (JsonDataSource.#instanciaUnica) {
      throw new Error('JsonDataSource es un Singleton. Usa JsonDataSource.getInstancia().');
    }
    this.dataDir = dataDir;
  }

  /**
   * Punto de acceso global y controlado a la única instancia.
   * @returns {JsonDataSource}
   */
  static getInstancia() {
    if (!JsonDataSource.#instanciaUnica) {
      JsonDataSource.#instanciaUnica = new JsonDataSource(process.env.MOVESHARE_DATA_DIR || DEFAULT_DATA_DIR);
    }
    return JsonDataSource.#instanciaUnica;
  }

  /**
   * Solo para pruebas: permite reiniciar la instancia (ej. para usar otra carpeta).
   */
  static reiniciarParaPruebas() {
    JsonDataSource.#instanciaUnica = null;
  }

  #rutaDe(nombreArchivo) {
    return path.join(this.dataDir, nombreArchivo);
  }

  /**
   * Lee una colección (array) desde un archivo JSON. Si no existe, la crea vacía.
   * @param {string} nombreArchivo
   * @returns {Array}
   */
  leerColeccion(nombreArchivo) {
    const ruta = this.#rutaDe(nombreArchivo);
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      if (!fs.existsSync(ruta)) {
        fs.writeFileSync(ruta, '[]', 'utf8');
        return [];
      }
      const raw = fs.readFileSync(ruta, 'utf8');
      if (!raw || raw.trim() === '') return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`[JsonDataSource] Error leyendo ${nombreArchivo}:`, error.message);
      return [];
    }
  }

  /**
   * Escribe una colección completa en un archivo JSON.
   * @param {string} nombreArchivo
   * @param {Array} items
   * @returns {boolean}
   */
  escribirColeccion(nombreArchivo, items) {
    try {
      if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });
      fs.writeFileSync(this.#rutaDe(nombreArchivo), JSON.stringify(items, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`[JsonDataSource] Error escribiendo ${nombreArchivo}:`, error.message);
      return false;
    }
  }
}

module.exports = { JsonDataSource };
