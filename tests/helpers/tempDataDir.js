// tests/helpers/tempDataDir.js
// Apunta la persistencia a una carpeta temporal para que las pruebas no
// modifiquen los archivos reales de /data. Debe requerirse ANTES que los módulos.

const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moveshare-test-'));
process.env.MOVESHARE_DATA_DIR = dir;

process.on('exit', () => {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignorar */ }
});

module.exports = { dir };
