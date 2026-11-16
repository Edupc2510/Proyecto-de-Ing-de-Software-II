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
// Sprint 2-4 · US19, US25, US27, US28, US32
const tripCatalogRoutes = require('./src/tripCatalog/tripCatalogRoutes');
const accountRoutes = require('./src/account/accountRoutes');
const ratingRoutes = require('./src/ratings/ratingRoutes');
// Sprint 2-4 · Eduardo (US15, US17, US30, US35, US37)
const requestRoutes = require('./src/requests/requestRoutes');
const reservationRoutes = require('./src/reservations/reservationRoutes');
const frequentDriverRoutes = require('./src/drivers/frequentDriverRoutes');
const claimRoutes = require('./src/claims/claimRoutes');
const myTripsRoutes = require('./src/myTrips/myTripsRoutes');

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
// Sprint 2-4 · US19, US25, US27, US28, US32
app.use('/trip-catalog', tripCatalogRoutes);  // US27 / US28 - Ordenar viajes por horario y por asientos
app.use('/account', accountRoutes);           // US19 - Editar perfil · US32 - Gestión avanzada de cuenta
app.use('/ratings', ratingRoutes);            // US25 - Calificar pasajero (convive con US24 en /ratings)
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
