// public/js/theme.js
// Modo oscuro (US32, escenario 03). Se carga en <head> para aplicar el tema
// guardado ANTES de pintar la página (sin parpadeo) y luego lo sincroniza con
// la preferencia de la cuenta (GET /account/settings).
(function () {
  var KEY = 'moveshare.theme';

  /** Cambia el logo por su versión clara/oscura según el tema. */
  function swapLogos(dark) {
    var imgs = document.querySelectorAll('img[src*="moveshare-logo"]');
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute('src');
      var next = dark
        ? src.replace('moveshare-logo-dark.png', 'moveshare-logo.png')
        : src.replace(/moveshare-logo\.png$/, 'moveshare-logo-dark.png');
      if (next !== src) imgs[i].setAttribute('src', next);
    }
  }

  function apply(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    swapLogos(dark);
  }

  try { apply(localStorage.getItem(KEY) === 'dark'); } catch (e) { /* sin almacenamiento */ }

  window.MoveShareTheme = {
    /** Cambia el tema de inmediato y lo recuerda en este navegador. */
    apply: function (dark) {
      apply(dark);
      try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) { /* ignorar */ }
    },
    /** Alinea el tema con la preferencia guardada en la cuenta. */
    sync: function () {
      var self = this;
      return fetch('/account/settings')
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) { if (data && data.success) self.apply(Boolean(data.ajustes.darkMode)); })
        .catch(function () { /* sin conexión: se mantiene el tema local */ });
    },
  };

  document.addEventListener('DOMContentLoaded', function () {
    swapLogos(document.documentElement.getAttribute('data-theme') === 'dark'); // el <head> corre antes de que existan las imágenes
    window.MoveShareTheme.sync();
  });
})();
