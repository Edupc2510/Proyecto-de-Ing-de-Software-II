// public/js/calificaciones.js
// Pantalla "Calificar pasajeros" (US25): el conductor califica a sus pasajeros
// cuando el viaje terminó. Estados (igual que la US24): por_calificar · en_curso · calificado.
(function () {
  var MENSAJE_RED = 'Error de conexión. No se guardó la calificación. Inténtalo de nuevo.';
  var ETIQUETAS = { por_calificar: 'Por calificar', en_curso: 'Viaje en curso', calificado: 'Calificado' };
  var MAX_COMENTARIO = 300;

  var $ = function (id) { return document.getElementById(id); };

  function escapar(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function api(url, opciones) {
    if (navigator.onLine === false) return Promise.reject({ red: true });
    return fetch(url, opciones).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { alert('Tu sesión expiró. Inicia sesión nuevamente.'); window.location.href = '/login'; throw { sesion: true }; }
        return { ok: res.ok, data: data };
      });
    }, function () { throw { red: true }; });
  }

  function aviso(tipo, texto) {
    var el = $('aviso');
    el.className = 'notice notice--show notice--' + tipo;
    el.textContent = texto;
  }

  function estrellas(valor, interactivo) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += interactivo
        ? '<button type="button" class="star' + (i <= valor ? ' star--on' : '') + '" data-valor="' + i + '" aria-label="' + i + ' de 5">★</button>'
        : '<span class="star' + (i <= valor ? ' star--on' : '') + '" aria-hidden="true">★</span>';
    }
    return html;
  }

  function tarjetaViaje(v) {
    var ruta = escapar((v.origin || '').split(',')[0]) + ' → ' + escapar((v.dest || '').split(',')[0]);
    var cuerpo = '';

    if (v.ratingStatus === 'por_calificar') {
      cuerpo =
        '<form class="rating-form" data-booking="' + escapar(v.bookingId) + '">' +
          '<div class="stars" role="radiogroup" aria-label="Calificación">' + estrellas(0, true) + '</div>' +
          '<textarea maxlength="' + MAX_COMENTARIO + '" placeholder="Comentario (opcional)"></textarea>' +
          '<div class="field__error" data-error></div>' +
          '<div class="actions"><button type="submit" class="btn btn--primary btn--sm">Enviar calificación</button></div>' +
        '</form>';
    } else if (v.ratingStatus === 'calificado' && v.rating) {
      cuerpo = '<div class="stars">' + estrellas(v.rating.score, false) + '</div>' +
        (v.rating.comment ? '<div class="trip-item__meta">“' + escapar(v.rating.comment) + '”</div>' : '');
    } else {
      cuerpo = '<div class="trip-item__meta">Podrás calificar al pasajero cuando el viaje haya finalizado.</div>';
    }

    return '<div class="trip-item">' +
      '<div class="trip-item__head">' +
        '<div><div class="trip-item__route">' + escapar(v.passengerName) + '</div>' +
        '<div class="trip-item__meta">' + ruta + ' · ' + escapar(v.time) + '</div></div>' +
        '<span class="badge badge--' + v.ratingStatus + '">' + ETIQUETAS[v.ratingStatus] + '</span>' +
      '</div>' + cuerpo + '</div>';
  }

  function pintar(viajes) {
    var lista = $('lista');
    if (!viajes.length) {
      lista.innerHTML = '<p class="empty">Aún no tienes pasajeros con reserva confirmada en tus rutas.<br>' +
        'Para probar, usa “Generar datos de demostración”.</p>';
      return;
    }
    lista.innerHTML = viajes.map(tarjetaViaje).join('');

    lista.querySelectorAll('.rating-form').forEach(function (form) {
      var puntaje = 0;
      var botones = form.querySelectorAll('.star');
      botones.forEach(function (b) {
        b.addEventListener('click', function () {
          puntaje = Number(b.dataset.valor);
          botones.forEach(function (x) { x.classList.toggle('star--on', Number(x.dataset.valor) <= puntaje); });
          form.querySelector('[data-error]').textContent = '';
        });
      });
      form.addEventListener('submit', function (e) { e.preventDefault(); enviar(form, puntaje); });
    });
  }

  function enviar(form, puntaje) {
    var error = form.querySelector('[data-error]');
    if (!puntaje) { error.textContent = 'Elige una calificación de 1 a 5 estrellas.'; return; }

    var boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    api('/ratings/passengers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: form.dataset.booking, score: puntaje, comment: form.querySelector('textarea').value }),
    }).then(function (r) {
      if (!r.ok) { error.textContent = r.data.error || 'No se pudo guardar la calificación.'; boton.disabled = false; return; }
      aviso('success', r.data.message);
      return cargar();
    }).catch(function (e) {
      if (e && e.sesion) return;
      // Sin red: no se muestra como guardada y el formulario conserva lo escrito (esc.05)
      error.textContent = e && e.red ? MENSAJE_RED : 'No se pudo guardar la calificación.';
      boton.disabled = false;
    });
  }

  function cargar() {
    return api('/ratings/driver/trips').then(function (r) {
      if (!r.ok) return aviso('error', r.data.error || 'No se pudieron cargar tus viajes.');
      pintar(r.data);
    }).catch(function (e) { if (e && e.red) aviso('error', 'Error de conexión. Inténtalo más tarde.'); });
  }

  function demo(metodo, mensajeOk) {
    api('/ratings/driver/demo', { method: metodo }).then(function (r) {
      if (!r.ok) return aviso('error', r.data.error || 'No se pudo completar la acción.');
      aviso('info', mensajeOk);
      return cargar();
    }).catch(function (e) { if (e && e.red) aviso('error', 'Error de conexión. Inténtalo más tarde.'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('btn-demo').addEventListener('click', function () { demo('POST', 'Datos de demostración generados.'); });
    $('btn-demo-borrar').addEventListener('click', function () { demo('DELETE', 'Datos de demostración eliminados.'); });
    cargar();
  });
})();
