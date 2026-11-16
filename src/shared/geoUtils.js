// src/shared/geoUtils.js
// Utilidades geograficas para validar ubicaciones (US21 - punto de recojo).

const EARTH_RADIUS_M = 6371000;
const DEFAULT_MAX_DISTANCE_M = 1500; // tolerancia: 1.5 km de la ruta

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Verifica que un valor sea un par [lat, lng] valido.
 */
function isValidCoords(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;

  const lat = Number(coords[0]);
  const lng = Number(coords[1]);

  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Distancia en metros entre dos puntos [lat, lng] (formula de Haversine).
 */
function haversineDistance([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Distancia en metros desde un punto al segmento A-B.
 * Usa una proyeccion plana local (suficiente para distancias urbanas).
 */
function distanceToSegment(point, a, b) {
  const refLat = toRad(point[0]);
  const project = ([lat, lng]) => ({
    x: toRad(lng) * Math.cos(refLat) * EARTH_RADIUS_M,
    y: toRad(lat) * EARTH_RADIUS_M,
  });

  const p = project(point);
  const pa = project(a);
  const pb = project(b);

  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const lengthSq = dx * dx + dy * dy;

  // Si A y B coinciden, es la distancia al punto A
  if (lengthSq === 0) return Math.hypot(p.x - pa.x, p.y - pa.y);

  // Proyeccion del punto sobre el segmento, limitada a [0, 1]
  let t = ((p.x - pa.x) * dx + (p.y - pa.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = pa.x + t * dx;
  const closestY = pa.y + t * dy;

  return Math.hypot(p.x - closestX, p.y - closestY);
}

/**
 * Indica si un punto esta "dentro de la ruta": a no mas de maxDistance metros
 * del trayecto entre el origen y el destino del viaje.
 */
function isPointNearRoute(point, originCoords, destCoords, maxDistance = DEFAULT_MAX_DISTANCE_M) {
  if (!isValidCoords(point) || !isValidCoords(originCoords) || !isValidCoords(destCoords)) {
    return false;
  }

  const toNumbers = (c) => [Number(c[0]), Number(c[1])];
  const distance = distanceToSegment(toNumbers(point), toNumbers(originCoords), toNumbers(destCoords));

  return distance <= maxDistance;
}

module.exports = {
  DEFAULT_MAX_DISTANCE_M,
  isValidCoords,
  haversineDistance,
  distanceToSegment,
  isPointNearRoute,
};
