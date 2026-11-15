// app.js
// Punto de entrada principal de MoveShare

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const authRoutes = require('./src/auth/authRoutes');
const dashboardRoutes = require('./src/dashboards/dashboardRoutes');
const routeRoutes = require('./src/trips/routeRoutes');
// Sprint 2-4 · Eduardo (US15, US17, US30, US35, US37)
const requestRoutes = require('./src/requests/requestRoutes');
const reservationRoutes = require('./src/reservations/reservationRoutes');
const frequentDriverRoutes = require('./src/drivers/frequentDriverRoutes');
const claimRoutes = require('./src/claims/claimRoutes');
const myTripsRoutes = require('./src/myTrips/myTripsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE GLOBAL
// ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Archivos estáticos (CSS, JS, imágenes)
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'moveshare_secret_key_dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true en producción con HTTPS
    maxAge: 1000 * 60 * 60 * 24, // 24 horas
  },
}));

// ─────────────────────────────────────────────────────────────
// RUTAS
// ─────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/trips', routeRoutes);
// Sprint 2-4 · Eduardo (US15, US17, US30, US35, US37)
app.use('/requests', requestRoutes);            // US15 - Estado de solicitudes
app.use('/reservations', reservationRoutes);    // US17 - Reservas · US35 - Confirmar participación
app.use('/frequent-drivers', frequentDriverRoutes); // US30 - Contactar conductores frecuentes
app.use('/claims', claimRoutes);                // US37 - Estado del reclamo
app.use('/mis-viajes', myTripsRoutes);          // Vista "Mis viajes" del pasajero
// Página principal (login/registro)
// Landing page principal
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  res.sendFile(path.join(__dirname, 'views', 'landing_page.html'));
});

// Página de login / registro
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }

  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ─────────────────────────────────────────────────────────────
// INICIO DEL SERVIDOR
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║         MoveShare - Servidor         ║');
  console.log(`  ║   Corriendo en: http://localhost:${PORT}  ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log('  📧 Email configurado:', process.env.EMAIL_USER || '⚠️  No configurado (.env)');
  console.log('');
});

module.exports = app;
