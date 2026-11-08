// shared/jsonStore.js
// Helper genérico para persistir colecciones en archivos JSON dentro de /data.
// Lo usan las reservas, calificaciones, alertas y notificaciones.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * Crea un "store" para un archivo JSON que contiene un array.
 * Si el archivo no existe, se crea vacío automáticamente.
 * @param {string} fileName - Nombre del archivo dentro de /data (ej: 'bookings.json')
 * @returns {{ read: Function, write: Function }}
 */
function createJsonStore(fileName) {
  const filePath = path.join(DATA_DIR, fileName);

  function read() {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf8');
        return [];
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      if (!raw || raw.trim() === '') return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`[JsonStore] Error leyendo ${fileName}:`, error.message);
      return [];
    }
  }

  function write(items) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`[JsonStore] Error escribiendo ${fileName}:`, error.message);
      return false;
    }
  }

  return { read, write };
}

module.exports = { createJsonStore };
