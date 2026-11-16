// account/settingsModel.js
// ─────────────────────────────────────────────────────────────
// Catálogo de ajustes de cuenta (US32). Es DATOS, no lógica: para agregar un
// interruptor nuevo basta con sumar una entrada aquí (OCP); la validación, el
// guardado y las consultas del AccountFacade lo reconocen automáticamente.
// ─────────────────────────────────────────────────────────────

const AJUSTES = Object.freeze({
  showPhone:         { porDefecto: true,  etiqueta: 'Mostrar teléfono a la comunidad' },
  pushNotifications: { porDefecto: true,  etiqueta: 'Notificaciones de coincidencias de ruta' },
  darkMode:          { porDefecto: false, etiqueta: 'Modo oscuro' },
  accountPaused:     { porDefecto: false, etiqueta: 'Pausar mi cuenta' },
});

const CLAVES_AJUSTES = Object.freeze(Object.keys(AJUSTES));

/** Ajustes por defecto: { showPhone: true, ... } */
function ajustesPorDefecto() {
  return Object.fromEntries(CLAVES_AJUSTES.map(clave => [clave, AJUSTES[clave].porDefecto]));
}

const OPCIONES_PREFERENCIA = Object.freeze(['si', 'no', 'indistinto']);
const CLAVES_PREFERENCIAS = Object.freeze(['conversacion', 'musica', 'mascotas']);

function preferenciasPorDefecto() {
  return Object.fromEntries(CLAVES_PREFERENCIAS.map(clave => [clave, 'indistinto']));
}

module.exports = {
  AJUSTES,
  CLAVES_AJUSTES,
  ajustesPorDefecto,
  OPCIONES_PREFERENCIA,
  CLAVES_PREFERENCIAS,
  preferenciasPorDefecto,
};
