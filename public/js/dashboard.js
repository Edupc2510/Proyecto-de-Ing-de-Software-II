// public/js/dashboard.js
// Lógica del dashboard: selección de rol, mapa Leaflet, formulario conductor, switch PC/Mobile

// ─────────────────────────────────────────────────────────────
// ESTADO GLOBAL DEL DASHBOARD
// ─────────────────────────────────────────────────────────────
let currentRole = null;              // 'passenger' | 'driver' | null
let currentView = 'pc';              // 'pc' | 'mobile'

let currentUserProfile = null;
// Mapa del pasajero
let mapInstance = null;
let mapInitialized = false;

let driverDestinationMarker = null;
let selectedDestCoords = null;


let driverRouteLine = null;
let driverRouteRequestId = 0;

let modalRouteLine = null;
let modalRouteRequestId = 0;
// Mapa del conductor
let driverMapInstance = null;
let driverMarker = null;
let selectedOriginCoords = null;

// Modal de confirmación del pasajero
let modalMapInstance = null;
let selectedRouteIdForBooking = null;

// Rutas publicadas durante la sesión actual del conductor
let publishedRoutes = [];
// ─────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  setViewMode('pc');
  showScreen('role');

  const navbarUser = document.getElementById('navbar-user');

  if (navbarUser) {
    navbarUser.addEventListener('click', openProfileModal);
  }
});

/**
 * Carga el perfil del usuario autenticado y actualiza el navbar.
 */
async function loadUserProfile() {
  try {
    const res  = await fetch('/dashboard/profile');
    const data = await res.json();

    if (!data.success) {
      window.location.href = '/';
      return;
    }

    const { firstName, lastName, email } = data.user;
    const fullName = `${firstName} ${lastName}`;
    currentUserProfile = data.user;

    // Actualizar greeting
    const greeting = document.getElementById('role-greeting');
    if (greeting) greeting.textContent = `Hola, ${firstName} 👋`;

    // Actualizar navbar
    const usernameEl = document.getElementById('navbar-username');
    const avatarEl   = document.getElementById('navbar-avatar');
    if (usernameEl) usernameEl.textContent = firstName;
    if (avatarEl)   avatarEl.textContent   = firstName.charAt(0).toUpperCase();

  } catch (err) {
    console.error('[Dashboard] Error cargando perfil:', err);
  }
}
//ABRIR PERFIL 
function openProfileModal() {
  const modal = document.getElementById('profile-modal');

  if (!modal) return;

  if (!currentUserProfile) {
    alert('No se pudo cargar la información del perfil.');
    return;
  }

  renderProfileModal(currentUserProfile);
  modal.style.display = 'flex';
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');

  if (modal) {
    modal.style.display = 'none';
  }
}

function renderProfileModal(user) {
  const firstName = user.firstName || 'Usuario';
  const lastName = user.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const email = user.email || 'No registrado';
  const dni = user.dni || 'No registrado';

  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'No disponible';

  const profileAvatar = document.getElementById('profile-avatar');
  const profileFullName = document.getElementById('profile-full-name');
  const profileEmail = document.getElementById('profile-email');
  const profileFirstName = document.getElementById('profile-first-name');
  const profileLastName = document.getElementById('profile-last-name');
  const profileDni = document.getElementById('profile-dni');
  const profileCreatedAt = document.getElementById('profile-created-at');

  if (profileAvatar) profileAvatar.textContent = firstName.charAt(0).toUpperCase();
  if (profileFullName) profileFullName.textContent = fullName;
  if (profileEmail) profileEmail.textContent = email;
  if (profileFirstName) profileFirstName.textContent = firstName;
  if (profileLastName) profileLastName.textContent = lastName || 'No registrado';
  if (profileDni) profileDni.textContent = dni;
  if (profileCreatedAt) profileCreatedAt.textContent = createdAt;
}
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.addEventListener('click', (event) => {
  const modal = document.getElementById('profile-modal');

  if (event.target === modal) {
    closeProfileModal();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeProfileModal();
  }
});
// ─────────────────────────────────────────────────────────────
// NAVEGACIÓN ENTRE PANTALLAS
// ─────────────────────────────────────────────────────────────

/**
 * Muestra una pantalla específica y oculta las demás.
 * @param {string} name - 'role' | 'passenger' | 'driver'
 */
function showScreen(name) {
  const screens = ['role', 'passenger', 'driver'];
  screens.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.style.display = (s === name) ? '' : 'none';
  });
}

/**
 * Vuelve a la pantalla de selección de rol.
 */
function goToRoleSelection() {
  currentRole = null;

  // Ocultar badge de rol
  const badge = document.getElementById('role-badge');
  if (badge) badge.style.display = 'none';

  showScreen('role');
}

// ─────────────────────────────────────────────────────────────
// SELECCIÓN DE ROL
// ─────────────────────────────────────────────────────────────

/**
 * Selecciona el rol del usuario para esta sesión y navega a la vista correspondiente.
 * @param {string} role - 'passenger' | 'driver'
 */
function selectRole(role) {
  currentRole = role;

  // Mostrar badge en navbar
  const badge     = document.getElementById('role-badge');
  const badgeText = document.getElementById('role-badge-text');
  if (badge && badgeText) {
    badgeText.textContent = role === 'passenger' ? 'Pasajero' : 'Conductor';
    badge.style.display = 'inline-flex';
  }

  if (role === 'passenger') {
    showScreen('passenger');

    loadPassengerRoutes();
    // Inicializar mapa después de que el DOM esté visible
    requestAnimationFrame(() => {
      setTimeout(() => initPassengerMap(), 100);
    });
  } else if (role === 'driver') {
    showScreen('driver');
    renderPublishedRoutes();
    requestAnimationFrame(() => {
      setTimeout(() => initDriverMap(), 100);
    });
    loadDriverPublishedRoutes();

    //bloquear horas en el formulario
    const timeInput = document.getElementById('d-time');
  if (timeInput) {
    const ahora = new Date();
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    // Esto genera un string "HH:MM" con la hora actual exacta
    timeInput.min = `${horas}:${minutos}`;
  }
  }
}
// ─────────────────────────────────────────────────────────────
// PASAJERO: MAPA Y RUTAS DISPONIBLES
// ─────────────────────────────────────────────────────────────
// Nota:
// El pasajero NO reserva directamente desde el botón "Seleccionar".
// Primero se abre el modal de confirmación con openRouteModal().
// La reserva real recién ocurre en confirmFinalBooking().

function initPassengerMap() {
  // Si el mapa ya fue inicializado, solo refrescarlo
  if (mapInitialized && mapInstance) {
    mapInstance.invalidateSize();
    return;
  }

  const mapEl = document.getElementById('passenger-map');
  if (!mapEl) return;

  // Centro neutral de Lima para que el mapa abra en un punto medio amigable
  const center = [-12.0892, -77.0067];

  // Crear mapa base pasivo
  mapInstance = L.map('passenger-map', {
    center,
    zoom: 13,
    zoomControl: true,
    attributionControl: true,
  });

  // Capa de tiles OpenStreetMap (Dibuja las calles reales)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapInstance);

  // Marcar como inicializado para que no se duplique
  mapInitialized = true;
}
/**
 * Maneja la publicación de una nueva ruta por el conductor.
 * Valida el formulario, crea el registro y lo renderiza en pantalla.
 */
/**
 * Maneja la publicación de una nueva ruta por el conductor.
 * Valida el formulario, crea el registro y lo envía al backend.
 */
// ─────────────────────────────────────────────────────────────
// FORMULARIO CONDUCTOR
// ─────────────────────────────────────────────────────────────

/**
 * Maneja la publicación de una nueva ruta por el conductor.
 * Valida el formulario, crea el registro y lo envía al backend.
 */
async function handlePublishRoute() {
  const origin = document.getElementById('d-origin').value.trim();
  const dest = document.getElementById('d-dest').value.trim();
  const seatsRaw = document.getElementById('d-seats').value;
  const time = document.getElementById('d-time').value;
  const notes = document.getElementById('d-notes').value.trim();

  const msgEl = document.getElementById('driver-form-message');

  const showDriverMsg = (type, text) => {
    if (!msgEl) {
      alert(text.replace(/<[^>]*>/g, ''));
      return;
    }

    msgEl.className = `form-message form-message--${type}`;
    msgEl.innerHTML = text;
    msgEl.style.display = 'flex';
  };

  const hideDriverMsg = () => {
    if (msgEl) msgEl.style.display = 'none';
  };

  hideDriverMsg();

  if (!origin || !dest) {
    showDriverMsg('error', '⚠️ El origen y destino son obligatorios.');
    return;
  }

  if (origin.toLowerCase() === dest.toLowerCase()) {
    showDriverMsg('error', '⚠️ El origen y el destino no pueden ser iguales.');
    return;
  }

  if (!selectedOriginCoords || !Array.isArray(selectedOriginCoords) || selectedOriginCoords.length !== 2) {
    showDriverMsg('error', '⚠️ Debes seleccionar el origen desde las sugerencias de dirección.');
    return;
  }

  const originLat = Number(selectedOriginCoords[0]);
  const originLng = Number(selectedOriginCoords[1]);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    originLat < -90 ||
    originLat > 90 ||
    originLng < -180 ||
    originLng > 180
  ) {
    showDriverMsg('error', '⚠️ Las coordenadas del origen no son válidas. Selecciona nuevamente el origen.');
    return;
  }

  if (!selectedDestCoords || !Array.isArray(selectedDestCoords) || selectedDestCoords.length !== 2) {
    showDriverMsg('error', '⚠️ Debes seleccionar el destino desde las sugerencias de dirección.');
    return;
  }

  const destLat = Number(selectedDestCoords[0]);
  const destLng = Number(selectedDestCoords[1]);

  if (
    !Number.isFinite(destLat) ||
    !Number.isFinite(destLng) ||
    destLat < -90 ||
    destLat > 90 ||
    destLng < -180 ||
    destLng > 180
  ) {
    showDriverMsg('error', '⚠️ Las coordenadas del destino no son válidas. Selecciona nuevamente el destino.');
    return;
  }

  const seats = Number(seatsRaw);

  if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
    showDriverMsg('error', '⚠️ Selecciona una cantidad de asientos entre 1 y 4.');
    return;
  }

  if (!time) {
    showDriverMsg('error', '⚠️ Indica la hora de salida.');
    return;
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (!timeRegex.test(time)) {
    showDriverMsg('error', '⚠️ La hora debe tener el formato HH:mm.');
    return;
  }

  const [hours, minutes] = time.split(':').map(Number);
  const selectedDepartureTime = new Date();
  selectedDepartureTime.setHours(hours, minutes, 0, 0);

  if (selectedDepartureTime.getTime() <= Date.now()) {
    showDriverMsg('error', '⚠️ La hora de salida no puede estar vencida.');
    return;
  }

  const routePayload = {
    origin,
    originCoords: [originLat, originLng],
    dest,
    destCoords: [destLat, destLng],
    seats,
    time,
    notes
  };

  try {
    const res = await fetch('/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routePayload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showDriverMsg('error', `⚠️ ${data.error || 'No se pudo publicar la ruta.'}`);
      return;
    }

    document.getElementById('d-origin').value = '';
    document.getElementById('d-dest').value = '';
    document.getElementById('d-seats').value = '';
    document.getElementById('d-time').value = '';
    document.getElementById('d-notes').value = '';

    if (driverMarker && driverMapInstance) {
      driverMapInstance.removeLayer(driverMarker);
      driverMarker = null;
    }

    if (driverDestinationMarker && driverMapInstance) {
      driverMapInstance.removeLayer(driverDestinationMarker);
      driverDestinationMarker = null;
    }

    clearDriverRoutePreview();

    selectedOriginCoords = null;
    selectedDestCoords = null;

    const createdRoute = data.route || {
      ...routePayload,
      id: Date.now()
    };

    publishedRoutes.unshift({
      ...createdRoute,
      publishedAt: 'ahora'
    });

    renderPublishedRoutes();

    showDriverMsg('success', '✅ ¡Ruta publicada! Los pasajeros ya pueden verla.');
    setTimeout(hideDriverMsg, 4000);

  } catch (error) {
    console.error('[Dashboard] Error publicando ruta:', error);
    showDriverMsg('error', '⚠️ Error de conexión al intentar publicar la ruta.');
  }
}

/**
 * Renderiza la lista de rutas publicadas en la sesión.
 */
function renderPublishedRoutes() {
  const container = document.getElementById('published-routes');
  if (!container) return;

  if (publishedRoutes.length === 0) {
    container.innerHTML = '';
    return;
  }

  const heading = `<h3 style="font-family: var(--font-display); font-size:0.95rem; font-weight:700; color:var(--c-navy); margin-bottom:var(--space-sm);">Mis rutas publicadas</h3>`;

  const items = publishedRoutes.map(route => `
    <div class="published-route-item">
      <div class="published-route-item__header">
        <div class="published-route-item__title">
          ${escapeHTML(route.origin)} → ${escapeHTML(route.dest)}
        </div>
        <span class="published-route-item__time">Publicado ${route.publishedAt}</span>
      </div>
      <div class="published-route-item__details">
        <span class="published-route-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
          ${route.time}
        </span>
        <span class="published-route-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          ${route.seats} asiento${route.seats !== 1 ? 's' : ''}
        </span>
        ${route.notes ? `<span class="published-route-badge">${escapeHTML(route.notes.slice(0, 40))}${route.notes.length > 40 ? '…' : ''}</span>` : ''}
        <button
          type="button"
          class="published-route-cancel"
          data-route-id="${route.id}"
        >
          Cancelar ruta
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = heading + items;
  container.querySelectorAll('.published-route-cancel').forEach(button => {
  button.addEventListener('click', () => {
    const routeId = button.dataset.routeId;
    cancelPublishedRoute(routeId);
    });
  });

}
async function loadDriverPublishedRoutes() {
  try {
    const res = await fetch('/trips/mine');
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      console.warn('[Dashboard] No se pudieron cargar las rutas del conductor:', data.error);
      publishedRoutes = [];
      renderPublishedRoutes();
      return;
    }

    if (!Array.isArray(data)) {
      publishedRoutes = [];
      renderPublishedRoutes();
      return;
    }

    publishedRoutes = data.map(route => ({
      ...route,
      publishedAt: route.createdAt
        ? new Date(route.createdAt).toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'anteriormente'
    }));

    renderPublishedRoutes();

  } catch (error) {
    console.error('[Dashboard] Error cargando rutas publicadas:', error);
    publishedRoutes = [];
    renderPublishedRoutes();
  }
}
async function cancelPublishedRoute(routeId) {
  if (!routeId) {
    alert('No se pudo identificar la ruta a cancelar.');
    return;
  }

  const confirmCancel = confirm('¿Seguro que deseas cancelar esta ruta? Los pasajeros ya no podrán verla.');

  if (!confirmCancel) return;

  try {
    const res = await fetch(`/trips/${routeId}`, {
      method: 'DELETE'
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(`⚠️ ${data.error || 'No se pudo cancelar la ruta.'}`);
      return;
    }

    publishedRoutes = publishedRoutes.filter(route => String(route.id) !== String(routeId));

    renderPublishedRoutes();

    if (typeof loadPassengerRoutes === 'function') {
      await loadPassengerRoutes();
    }

    alert(`✅ ${data.message || 'Ruta cancelada correctamente.'}`);

  } catch (error) {
    console.error('[Dashboard] Error cancelando ruta:', error);
    alert('Error de conexión al cancelar la ruta.');
  }
}
function setDriverOriginLocation(addressName, lat, lng) {
  const originLat = Number(lat);
  const originLng = Number(lng);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    originLat < -90 ||
    originLat > 90 ||
    originLng < -180 ||
    originLng > 180
  ) {
    return false;
  }

  const originInput = document.getElementById('d-origin');

  if (originInput) {
    originInput.value = addressName || `${originLat}, ${originLng}`;
  }

  selectedOriginCoords = [originLat, originLng];

  if (driverMapInstance && typeof L !== 'undefined') {
    const latlng = L.latLng(originLat, originLng);

    driverMapInstance.setView(latlng, 16);

    if (driverMarker) {
      driverMarker.setLatLng(latlng);
    } else {
      driverMarker = L.marker(latlng, { draggable: true }).addTo(driverMapInstance);

      driverMarker.on('dragend', function () {
        const changedPos = driverMarker.getLatLng();
        selectedOriginCoords = [changedPos.lat, changedPos.lng];
      });
    }
  }

  updateDriverRoutePreview();

  return true;
}

function clearDriverOriginLocation(options = {}) {
  const keepInput = options.keepInput !== false;
  const originInput = document.getElementById('d-origin');

  selectedOriginCoords = null;

  if (!keepInput && originInput) {
    originInput.value = '';
  }

  if (driverMarker && driverMapInstance) {
    driverMapInstance.removeLayer(driverMarker);
    driverMarker = null;
  }

  clearDriverRoutePreview();
}
function setDriverDestinationLocation(addressName, lat, lng) {
  const destLat = Number(lat);
  const destLng = Number(lng);

  if (
    !Number.isFinite(destLat) ||
    !Number.isFinite(destLng) ||
    destLat < -90 ||
    destLat > 90 ||
    destLng < -180 ||
    destLng > 180
  ) {
    return false;
  }

  const destInput = document.getElementById('d-dest');

  if (destInput) {
    destInput.value = addressName || `${destLat}, ${destLng}`;
  }

  selectedDestCoords = [destLat, destLng];

  if (driverMapInstance && typeof L !== 'undefined') {
    const latlng = L.latLng(destLat, destLng);

    driverMapInstance.setView(latlng, 16);

    if (driverDestinationMarker) {
      driverDestinationMarker.setLatLng(latlng);
    } else {
      driverDestinationMarker = L.marker(latlng, { draggable: true }).addTo(driverMapInstance);

      driverDestinationMarker.on('dragend', function () {
        const changedPos = driverDestinationMarker.getLatLng();
        selectedDestCoords = [changedPos.lat, changedPos.lng];
      });
    }

    driverDestinationMarker.bindPopup('Destino').openPopup();
  }
  updateDriverRoutePreview();
  return true;
}

function clearDriverDestinationLocation(options = {}) {
  const keepInput = options.keepInput !== false;
  const destInput = document.getElementById('d-dest');

  selectedDestCoords = null;

  if (!keepInput && destInput) {
    destInput.value = '';
  }

  if (driverDestinationMarker && driverMapInstance) {
    driverMapInstance.removeLayer(driverDestinationMarker);
    driverDestinationMarker = null;
  }
  clearDriverRoutePreview();
}
async function getRoadRoutePoints(originPoint, destPoint) {
  const [originLat, originLng] = originPoint;
  const [destLat, destLng] = destPoint;

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLng},${originLat};${destLng},${destLat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('No se pudo obtener la ruta por calles.');
  }

  const data = await response.json();

  const coordinates = data?.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('OSRM no devolvió una geometría válida.');
  }

  // OSRM / GeoJSON devuelve [lng, lat].
  // Leaflet necesita [lat, lng].
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

function getRouteLineStyle(isFallback = false) {
  if (isFallback) {
    return {
      weight: 4,
      opacity: 0.75,
      dashArray: '8, 8'
    };
  }

  return {
    weight: 5,
    opacity: 0.9
  };
}
async function updateDriverRoutePreview() {
  if (!driverMapInstance || typeof L === 'undefined') return;

  if (
    !Array.isArray(selectedOriginCoords) ||
    !Array.isArray(selectedDestCoords) ||
    selectedOriginCoords.length !== 2 ||
    selectedDestCoords.length !== 2
  ) {
    return;
  }

  const originLat = Number(selectedOriginCoords[0]);
  const originLng = Number(selectedOriginCoords[1]);
  const destLat = Number(selectedDestCoords[0]);
  const destLng = Number(selectedDestCoords[1]);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destLat) ||
    !Number.isFinite(destLng)
  ) {
    return;
  }

  const originPoint = [originLat, originLng];
  const destPoint = [destLat, destLng];

  const requestId = ++driverRouteRequestId;

  if (driverRouteLine) {
    driverMapInstance.removeLayer(driverRouteLine);
    driverRouteLine = null;
  }

  let routePoints = [originPoint, destPoint];
  let usedFallback = true;

  try {
    routePoints = await getRoadRoutePoints(originPoint, destPoint);
    usedFallback = false;
  } catch (error) {
    console.warn('[Dashboard] No se pudo dibujar ruta por calles. Usando línea recta:', error);
  }

  if (requestId !== driverRouteRequestId || !driverMapInstance) return;

  driverRouteLine = L.polyline(routePoints, getRouteLineStyle(usedFallback))
    .addTo(driverMapInstance);

  const bounds = L.latLngBounds(routePoints);

  driverMapInstance.fitBounds(bounds, {
    padding: [40, 40],
    maxZoom: 15
  });
}

function clearDriverRoutePreview() {
  driverRouteRequestId++;

  if (driverRouteLine && driverMapInstance) {
    driverMapInstance.removeLayer(driverRouteLine);
    driverRouteLine = null;
  }
}
window.setDriverDestinationLocation = setDriverDestinationLocation;
window.clearDriverDestinationLocation = clearDriverDestinationLocation;
window.setDriverOriginLocation = setDriverOriginLocation;
window.clearDriverOriginLocation = clearDriverOriginLocation;


function initDriverMap() {
  // Evitamos duplicar el mapa si ya se inicializó antes
  if (driverMapInstance) {
  setTimeout(() => driverMapInstance.invalidateSize(), 200);

  if (typeof window.initDriverAddressSearch === 'function') {
    window.initDriverAddressSearch();
  }

  loadDriverPublishedRoutes();

  return;
}

  const mapContainer = document.getElementById('driver-map');
  if (!mapContainer) return;

  // Inicializar centrado en Lima
  driverMapInstance = L.map('driver-map').setView([-12.046374, -77.042793], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(driverMapInstance);

  setTimeout(() => {
    driverMapInstance.invalidateSize();
  }, 200);

  // Agregamos el Buscador oficial de OpenStreetMap (Geocoder)
  // 💥 Buscador optimizado para usar la base de datos de Perú y Lima de forma segura
  // 💥 BUSCADOR EXTERNALIZADO: Forzamos a que el menú de direcciones sea HTML puro
  const geocoder = L.Control.geocoder({
    defaultMarkGeocode: false,
    placeholder: "Buscar dirección en Lima...",
    geocoder: new L.Control.Geocoder.Nominatim({
      geocodingQueryParams: {
        countrycodes: 'pe',
        viewbox: '-77.15,-12.20,-76.85,-11.90',
        bounded: 1
      }
    })
  }).addTo(driverMapInstance);

  // Al hacer click en la lupa o escribir, sacamos los resultados del control de Leaflet
  const geocoderContainer = geocoder.getContainer();
  
  // Bloqueo total directo en el contenedor nativo del plugin
  if (geocoderContainer) {
    L.DomEvent.disableScrollPropagation(geocoderContainer);
    L.DomEvent.disableClickPropagation(geocoderContainer);
    
    // Forzar el comportamiento nativo del scroll del navegador vía JS puro
    // Forzar el comportamiento nativo del scroll interno y bloquear la página entera
    geocoderContainer.addEventListener('wheel', function(e) {
      const results = geocoderContainer.querySelector('.leaflet-control-geocoder-results');
      if (results) {
        // 💥 Evita que se mueva la página web de fondo
        e.preventDefault(); 
        e.stopPropagation(); 
        
        // Mueve físicamente el scroll de la lista de direcciones
        results.scrollTop += e.deltaY;
      } 
    }, { passive: false }); // 💥 IMPORTANTE: Cambiado a false para poder usar preventDefault()
  }

  // Conservamos tu lógica original para marcar el punto encontrado
  geocoder.on('markgeocode', function(e) {
  const latlng = e.geocode.center;
  const addressName = e.geocode.name;

  setDriverOriginLocation(addressName, latlng.lat, latlng.lng);
  });
  if (typeof window.initDriverAddressSearch === 'function') {
    window.initDriverAddressSearch();
  }
  loadDriverPublishedRoutes();
}

/**
 * Escapa caracteres especiales HTML para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ─────────────────────────────────────────────────────────────
// SWITCH PC / MOBILE
// ─────────────────────────────────────────────────────────────

/**
 * Cambia entre modo PC (pantalla completa) y modo Mobile (simulación smartphone).
 * @param {string} mode - 'pc' | 'mobile'
 */
function setViewMode(mode) {
  currentView = mode;

  const viewport  = document.getElementById('app-viewport');
  const notch     = document.getElementById('phone-notch');
  const homeBar   = document.getElementById('phone-home-bar');
  const btnPc     = document.getElementById('btn-pc-mode');
  const btnMobile = document.getElementById('btn-mobile-mode');

  if (!viewport) return;

  // Remover clases anteriores
  viewport.classList.remove('mode-pc', 'mode-mobile');
  viewport.classList.add(`mode-${mode}`);

  // Botones activos
  if (btnPc)     btnPc.classList.toggle('view-switch__btn--active',     mode === 'pc');
  if (btnMobile) btnMobile.classList.toggle('view-switch__btn--active', mode === 'mobile');

  // Mostrar/ocultar decoraciones del teléfono
  if (notch)   notch.style.display   = mode === 'mobile' ? 'block' : 'none';
  if (homeBar) homeBar.style.display = mode === 'mobile' ? 'block' : 'none';

  // Si el mapa estaba visible, refrescar su tamaño
  if (mapInstance && currentRole === 'passenger') {
    setTimeout(() => mapInstance.invalidateSize(), 350);
  }
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────

async function handleLogout() {
  try {
    await fetch('/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignorar errores de red al cerrar sesión
  }
  window.location.href = '/';
}

/**
 * Pide todas las rutas publicadas al backend y las filtra mostrando lo que está "Cerca".
 * Usa la geolocalización del navegador.
 */
async function loadPassengerRoutes() {
  try {
    const res = await fetch('/trips');
    if (!res.ok) throw new Error('No se pudieron cargar las rutas disponibles.');

    const routes = await res.json();
    const routesContainer = document.getElementById('dynamic-passenger-routes');
    if (!routesContainer) return;

    if (!Array.isArray(routes) || routes.length === 0) {
      routesContainer.innerHTML = '<p style="padding: 1rem; color: #4A5068; text-align: center;">No hay rutas disponibles por el momento.</p>';
      return;
    }

    const getUserLocation = () => new Promise(resolve => {
      const defaultLocation = [-12.046374, -77.042793]; // Lima centro como respaldo

      if (!navigator.geolocation) {
        resolve(defaultLocation);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => resolve([position.coords.latitude, position.coords.longitude]),
        () => resolve(defaultLocation),
        { timeout: 2500 }
      );
    });

    const getRouteOriginCoords = (route) => {
      if (Array.isArray(route.originCoords) && route.originCoords.length === 2) {
        const lat = Number(route.originCoords[0]);
        const lng = Number(route.originCoords[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) return [lat, lng];
      }

      const text = String(route.origin || '').toLowerCase();

      if (text.includes('trujillo')) return [-12.0358, -77.0295];
      if (text.includes('san miguel')) return [-12.0768, -77.0863];
      if (text.includes('miraflores')) return [-12.1213, -77.0294];
      if (text.includes('agraria') || text.includes('molina')) return [-12.0868, -76.9781];

      return [-12.0916, -77.0353];
    };

    const [userLat, userLng] = await getUserLocation();

    routesContainer.innerHTML = routes.map((route, index) => {
      const driverOriginCoords = getRouteOriginCoords(route);

      const latDiff = driverOriginCoords[0] - userLat;
      const lngDiff = driverOriginCoords[1] - userLng;
      const distanceKM = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;

      return `
        <div class="route-card" style="margin-bottom: var(--space-sm); padding: 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: white;">
          <div class="route-card__stops">
            <div class="route-stop route-stop--origin">
              <div class="route-stop__dot route-stop__dot--origin"></div>
              <div class="route-stop__info">
                <span class="route-stop__label">Origen (A ${distanceKM.toFixed(1)} km de ti)</span>
                <span class="route-stop__name">${escapeHTML(route.origin || '')}</span>
              </div>
            </div>

            <div class="route-stop__line"></div>

            <div class="route-stop route-stop--dest">
              <div class="route-stop__dot route-stop__dot--dest"></div>
              <div class="route-stop__info">
                <span class="route-stop__label">Destino</span>
                <span class="route-stop__name">${escapeHTML(route.dest || '')}</span>
              </div>
            </div>
          </div>

          <div class="route-card__meta" style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <div>
              <span class="route-meta-chip">🕒 ${escapeHTML(route.time || '')}</span>
              <span class="route-meta-chip">💺 ${route.seats} asist.</span>
            </div>

            <button 
              type="button" 
              class="btn btn--primary btn--sm btn-select-route" 
              data-route-index="${index}" 
              style="padding: 6px 16px; font-size: 12px;"
            >
              Seleccionar
            </button>
          </div>
        </div>
      `;
    }).join('');

    routesContainer.querySelectorAll('.btn-select-route').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.routeIndex);
        const route = routes[index];

        if (!route) return;

        const [driverLat, driverLng] = getRouteOriginCoords(route);

        let destLat = null;
        let destLng = null;

        if (Array.isArray(route.destCoords) && route.destCoords.length === 2) {
          destLat = Number(route.destCoords[0]);
          destLng = Number(route.destCoords[1]);
        }

      openRouteModal(
        route.id,
        route.origin,
        route.dest,
        route.time,
        route.seats,
        driverLat,
        driverLng,
        destLat,
        destLng
        );
      });
    });

  } catch (err) {
    console.error('[Dashboard] Error cargando rutas:', err);

    const routesContainer = document.getElementById('dynamic-passenger-routes');

    if (routesContainer) {
      routesContainer.innerHTML = '<p style="padding: 1rem; color: #B00020; text-align: center;">No se pudieron cargar las rutas. Intenta nuevamente.</p>';
    }
  }
}
// ─────────────────────────────────────────────────────────────
// PASAJERO: MODAL DE CONFIRMACIÓN DE VIAJE
// ─────────────────────────────────────────────────────────────
// Esta zona controla únicamente:
// - abrir el modal
// - mostrar detalles de la ruta
// - mostrar el mapa del punto de encuentro
// - confirmar la reserva
// No debe mezclarse con la lógica del formulario del conductor.
function openRouteModal(routeId, origin, destination, time, seats, driverLat, driverLng, destLat, destLng) {
  selectedRouteIdForBooking = routeId;

  const modal = document.getElementById('route-detail-modal');

  if (!modal) {
    console.error('[Dashboard] No existe el modal #route-detail-modal en dashboard.html');
    alert('No se encontró la ventana de confirmación del viaje.');
    return;
  }

  const originText = document.getElementById('modal-origin-text');
  const destText = document.getElementById('modal-dest-text');
  const timeText = document.getElementById('modal-time-text');
  const seatsText = document.getElementById('modal-seats-text');

  if (originText) originText.textContent = origin;
  if (destText) destText.textContent = destination;
  if (timeText) timeText.textContent = time;

  if (seatsText) {
    seatsText.textContent = `${seats} asiento${Number(seats) === 1 ? '' : 's'} disponible${Number(seats) === 1 ? '' : 's'}`;
  }

  const confirmButton = document.getElementById('btn-confirm-booking');

  if (confirmButton) {
    confirmButton.disabled = false;
    confirmButton.textContent = 'Confirmar Viaje';
    confirmButton.onclick = () => confirmFinalBooking(selectedRouteIdForBooking);
  }

  modal.style.display = 'flex';

  const originLat = Number(driverLat);
  const originLng = Number(driverLng);
  const destinationLat = Number(destLat);
  const destinationLng = Number(destLng);
  const modalMapEl = document.getElementById('modal-map');

  if (
    !modalMapEl ||
    typeof L === 'undefined' ||
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng)
  ) {
    return;
  }

  // Esperamos un poco para que el modal ya tenga tamaño visible.
  setTimeout(() => {
    if (modalMapInstance) {
      modalMapInstance.remove();
      modalMapInstance = null;
    }

    modalMapEl.innerHTML = '';

    modalMapInstance = L.map('modal-map', {
      zoomControl: true
    }).setView([originLat, originLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(modalMapInstance);

    const originPoint = [originLat, originLng];

    L.marker(originPoint)
      .addTo(modalMapInstance)
      .bindPopup('Punto de encuentro')
      .openPopup();

    // Forzamos render inicial del mapa.
    modalMapInstance.invalidateSize();

    setTimeout(() => {
      if (modalMapInstance) {
        modalMapInstance.invalidateSize();
      }
    }, 200);

    if (
      Number.isFinite(destinationLat) &&
      Number.isFinite(destinationLng)
    ) {
      const destinationPoint = [destinationLat, destinationLng];

      L.marker(destinationPoint)
        .addTo(modalMapInstance)
        .bindPopup('Destino');

      drawModalRoute(originPoint, destinationPoint);
    }

  }, 150);
}
//funcion para dibujar la ruta del mapa en el aparatado de pasajeros
async function drawModalRoute(originPoint, destinationPoint) {
  if (!modalMapInstance || typeof L === 'undefined') return;

  const requestId = ++modalRouteRequestId;

  if (modalRouteLine && modalMapInstance) {
    modalMapInstance.removeLayer(modalRouteLine);
    modalRouteLine = null;
  }

  let routePoints = [originPoint, destinationPoint];
  let usedFallback = true;

  try {
    routePoints = await getRoadRoutePoints(originPoint, destinationPoint);
    usedFallback = false;
  } catch (error) {
    console.warn('[Dashboard] No se pudo dibujar la ruta del modal por calles. Usando línea recta:', error);
  }

  if (requestId !== modalRouteRequestId || !modalMapInstance) return;

  modalRouteLine = L.polyline(routePoints, getRouteLineStyle(usedFallback))
    .addTo(modalMapInstance);

  const bounds = L.latLngBounds(routePoints);

  modalMapInstance.fitBounds(bounds, {
    padding: [35, 35],
    maxZoom: 15
  });

  setTimeout(() => {
    if (modalMapInstance) {
      modalMapInstance.invalidateSize();
    }
  }, 100);
}
/**
 * Cierra la ventana modal.
 */
function closeRouteModal() {
  const modal = document.getElementById('route-detail-modal');

  if (modal) {
    modal.style.display = 'none';
  }

  selectedRouteIdForBooking = null;
  // Cancela cualquier intento pendiente de dibujar la ruta del modal
  modalRouteRequestId++;
  // La línea se destruye junto con el mapa, pero limpiamos la referencia
  modalRouteLine = null;

  if (modalMapInstance) {
    modalMapInstance.remove();
    modalMapInstance = null;
  }
}

// Escuchar clics fuera del contenedor blanco para cerrar automáticamente.
window.addEventListener('click', (e) => {
  const modal = document.getElementById('route-detail-modal');

  if (e.target === modal) {
    closeRouteModal();
  }
});

/**
 * Confirmación final del viaje: ejecuta la resta del asiento en el servidor.
 */
async function confirmFinalBooking(routeId) {
  if (!routeId) {
    alert('No se pudo identificar la ruta seleccionada. Intenta nuevamente.');
    return;
  }

  const confirmButton = document.getElementById('btn-confirm-booking');

  try {
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Confirmando...';
    }

    const res = await fetch('/trips/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routeId })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(`⚠️ ${data.error || 'No se pudo reservar el asiento.'}`);
      return;
    }

    alert(`🎉 ${data.message || '¡Te has unido a la ruta con éxito!'}`);

    closeRouteModal();
    await loadPassengerRoutes();

  } catch (err) {
    console.error('[Dashboard] Error al confirmar reserva:', err);
    alert('Error de conexión al procesar la reserva.');

  } finally {
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.textContent = 'Confirmar Viaje';
    }
  }
}