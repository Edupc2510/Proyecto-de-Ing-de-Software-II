const fs = require('node:fs');
const path = require('node:path');

// DAO: toda la persistencia de US36 queda aquí. US37 lee el mismo claims.json.
class ReportRepository {
  constructor(directory = process.env.MOVESHARE_DATA_DIR || path.join(__dirname, '../../data')) {
    this.filename = path.join(directory, 'claims.json');
  }
  read() {
    if (!fs.existsSync(this.filename)) return [];
    const rows = JSON.parse(fs.readFileSync(this.filename, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('El archivo de reclamos no es una lista.');
    return rows;
  }
  findRequest(userId, requestId) {
    return this.read().find(row => row.passengerId === String(userId) && row.requestId === requestId);
  }
  save(report) {
    const rows = this.read();
    const index = rows.findIndex(row => row.id === report.id);
    if (index < 0) rows.push(report);
    else rows[index] = report;
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    // Reemplazo desde un temporal para no dejar un JSON a medio escribir.
    const temporary = `${this.filename}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(rows, null, 2));
    fs.renameSync(temporary, this.filename);
    return report;
  }
}
module.exports = { ReportRepository };
