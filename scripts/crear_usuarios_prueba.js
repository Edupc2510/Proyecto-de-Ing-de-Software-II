// Crea 2 cuentas de prueba verificadas en data/users.json para tomar capturas en local.
// Uso (desde la raíz del proyecto):  npm run seed:demo
// Contraseña de ambas: Test1234!   ·   No subas data/ al repositorio.
const fs = require('fs');
const path = require('path');
const bcrypt = require(path.join(process.cwd(), 'node_modules', 'bcryptjs'));

const file = path.join(process.cwd(), 'data', 'users.json');
const users = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8') || '[]') : [];
const hash = bcrypt.hashSync('Test1234!', 10);

[
  { id: 'demo-conductor', firstName: 'Diego', lastName: 'Conductor', email: 'conductor.demo@ulima.edu.pe', dni: '70000001' },
  { id: 'demo-pasajera', firstName: 'Paula', lastName: 'Pasajera', email: 'pasajera.demo@ulima.edu.pe', dni: '70000002' },
].forEach(u => {
  if (!users.some(x => x.email === u.email)) {
    users.push({ ...u, password: hash, verified: true, createdAt: new Date().toISOString() });
  }
});

fs.writeFileSync(file, JSON.stringify(users, null, 2));
console.log('Listo: conductor.demo@ulima.edu.pe y pasajera.demo@ulima.edu.pe (contraseña Test1234!)');
