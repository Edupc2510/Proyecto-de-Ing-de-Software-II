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
const driverRatingRoutes = require('./src/ratings/driverRatingRoutes');
const notificationRoutes = require('./src/notifications/notificationRoutes');
const favoriteDriverRoutes = require('./src/drivers/favoriteDriverRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Patrón Observer: conecta notificaciones y fiabilidad con los eventos de viaje (US14, US31, US34)
require('./src/shared/events/registerTripSubscribers')();

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
app.use('/ratings', driverRatingRoutes);       // US24 - Calificar conductor
app.use('/notifications', notificationRoutes); // US31 - Alertas y notificaciones
app.use('/favorite-drivers', favoriteDriverRoutes); // US29 - Conductores frecuentes
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
