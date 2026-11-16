// public/js/cuenta.js
// Pantalla "Mi cuenta": editar perfil (US19) y privacidad/ajustes (US32).
(function () {
  var MENSAJE_RED = 'Error de conexión. Inténtalo más tarde.';
  var perfilActual = null;   // último perfil recibido del servidor
  var fotoPendiente;         // undefined = sin cambios · null = quitar · string = nueva foto (data URL)

  var $ = function (id) { return document.getElementById(id); };

  // ───────────── utilidades ─────────────

  /** fetch JSON que distingue: sesión vencida (401), error del servidor y falta de red. */
  function api(url, opciones) {
    if (navigator.onLine === false) return Promise.reject({ red: true });
    return fetch(url, opciones).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { sesionVencida(); throw { sesion: true }; }
        return { ok: res.ok, status: res.status, data: data };
      });
    }, function () { throw { red: true }; });
  }

  function sesionVencida() {
    alert('Tu sesión expiró. Inicia sesión nuevamente.');
    window.location.href = '/login';
  }

  function aviso(id, tipo, texto) {
    var el = $(id);
    el.className = 'notice notice--show notice--' + tipo;
    el.textContent = texto;
  }

  function ocultarAviso(id) { $(id).className = 'notice'; }

  function json(metodo, cuerpo) {
    return { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  }

  // ───────────── pestañas ─────────────

  function activarPestana(nombre) {
    ['perfil', 'ajustes'].forEach(function (t) {
      $('tab-' + t).hidden = t !== nombre;
      var boton = document.querySelector('[data-tab="' + t + '"]');
      boton.classList.toggle('tab--active', t === nombre);
      boton.setAttribute('aria-selected', String(t === nombre));
    });
  }

  // ───────────── US19: perfil ─────────────

  function pintarAvatar(perfil, foto) {
    var avatar = $('avatar');
    avatar.textContent = '';
    if (foto) {
      var img = document.createElement('img');
      img.alt = 'Foto de perfil';
      img.src = foto;
      avatar.appendChild(img);
    } else {
      avatar.textContent = (perfil.firstName || 'U').charAt(0).toUpperCase();
    }
  }

  function pintarPerfil(perfil) {
    perfilActual = perfil;
    fotoPendiente = undefined;
    $('f-firstName').value = perfil.firstName || '';
    $('f-lastName').value = perfil.lastName || '';
    $('f-email').value = perfil.email || '';
    $('f-dni').value = perfil.dni || '';
    $('f-phone').value = perfil.phone || '';
    ['conversacion', 'musica', 'mascotas'].forEach(function (k) { $('f-' + k).value = perfil.preferencias[k]; });
    pintarAvatar(perfil, perfil.photo);
    $('btn-quitar-foto').hidden = !perfil.photo;
  }

  function limpiarErrores() {
    document.querySelectorAll('.field__error').forEach(function (e) { e.textContent = ''; });
    document.querySelectorAll('.field--error').forEach(function (e) { e.classList.remove('field--error'); });
  }

  function marcarError(campo, mensaje) {
    var caja = $('err-' + campo);
    if (!caja) return;
    caja.textContent = mensaje;
    if (caja.parentElement.classList.contains('field')) caja.parentElement.classList.add('field--error');
  }

  /** Reduce la imagen elegida a 256 px (JPEG) para que quepa en el límite de 100 kb del servidor. */
  function reducirImagen(archivo) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) return reject(new Error('Elige una imagen PNG, JPG o WEBP.'));
      var lector = new FileReader();
      lector.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
      lector.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
        img.onload = function () {
          var lado = Math.min(img.width, img.height);
          var canvas = document.createElement('canvas');
          canvas.width = canvas.height = 256;
          canvas.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
          var calidad = 0.85, data = canvas.toDataURL('image/jpeg', calidad);
          while (data.length > 80000 && calidad > 0.3) { calidad -= 0.1; data = canvas.toDataURL('image/jpeg', calidad); }
          resolve(data);
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  function construirCambios() {
    var cambios = {
      firstName: $('f-firstName').value,
      lastName: $('f-lastName').value,
      phone: $('f-phone').value,
      preferencias: {
        conversacion: $('f-conversacion').value,
        musica: $('f-musica').value,
        mascotas: $('f-mascotas').value,
      },
    };
    if (fotoPendiente !== undefined) cambios.photo = fotoPendiente;
    return cambios;
  }

  function guardarPerfil(evento) {
    evento.preventDefault();
    limpiarErrores();
    ocultarAviso('perfil-aviso');

    var cambios = construirCambios();
    var vacios = false;
    ['firstName', 'lastName'].forEach(function (campo) {
      if (!cambios[campo].trim()) { marcarError(campo, 'Este campo es obligatorio.'); vacios = true; }
    });
    if (vacios) return aviso('perfil-aviso', 'error', 'Completa los campos obligatorios para guardar.'); // US19 esc.03

    var boton = $('btn-guardar-perfil');
    boton.disabled = true;
    api('/account/profile', json('PUT', cambios)).then(function (r) {
      if (r.ok) {
        pintarPerfil(r.data.perfil);
        return aviso('perfil-aviso', r.data.actualizado ? 'success' : 'info', r.data.mensaje);   // esc.01 y esc.04
      }
      if (r.data.errores) {                                                                         // esc.02
        Object.keys(r.data.errores).forEach(function (campo) { marcarError(campo, r.data.errores[campo].mensaje); });
      }
      aviso('perfil-aviso', 'error', r.data.error || 'No se pudo guardar el perfil.');
    }).catch(function (e) {
      if (e && e.red) aviso('perfil-aviso', 'error', MENSAJE_RED);
      else if (!e || !e.sesion) aviso('perfil-aviso', 'error', 'No se pudo guardar el perfil.');
    }).then(function () { boton.disabled = false; });
  }

  function cargarPerfil() {
    return api('/account/profile').then(function (r) {
      if (r.ok) pintarPerfil(r.data.perfil);
      else aviso('perfil-aviso', 'error', r.data.error || 'No se pudo cargar tu perfil.');
    }).catch(function (e) {
      if (e && e.red) aviso('perfil-aviso', 'error', MENSAJE_RED);
    });
  }

  // ───────────── US32: ajustes ─────────────

  function pintarAjustes(ajustes) {
    document.querySelectorAll('[data-setting]').forEach(function (input) {
      input.checked = Boolean(ajustes[input.dataset.setting]);
    });
    $('pausa-nota').classList.toggle('notice--show', Boolean(ajustes.accountPaused));
  }

  /** Cambia un interruptor; si falla (sin red o error), lo devuelve a su estado original (esc.05). */
  function cambiarAjuste(input) {
    var clave = input.dataset.setting;
    var nuevo = input.checked;
    var anterior = !nuevo;
    var cuerpo = {};
    cuerpo[clave] = nuevo;

    ocultarAviso('ajustes-aviso');
    input.disabled = true;
    if (clave === 'darkMode') window.MoveShareTheme.apply(nuevo); // cambio inmediato; se revierte si falla

    api('/account/settings', json('PUT', cuerpo)).then(function (r) {
      if (!r.ok) throw { servidor: r.data.error };
      pintarAjustes(r.data.ajustes);
      aviso('ajustes-aviso', 'success', r.data.mensaje);
    }).catch(function (e) {
      input.checked = anterior;
      if (clave === 'darkMode') window.MoveShareTheme.apply(anterior);
      if (e && e.sesion) return;
      aviso('ajustes-aviso', 'error', e && e.red ? MENSAJE_RED : ((e && e.servidor) || MENSAJE_RED));
    }).then(function () { input.disabled = false; });
  }

  function cargarAjustes() {
    return api('/account/settings').then(function (r) {
      if (r.ok) pintarAjustes(r.data.ajustes);
    }).catch(function () { /* el aviso aparece al intentar cambiar algo */ });
  }

  // ───────────── arranque ─────────────

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { activarPestana(b.dataset.tab); });
    });
    $('profile-form').addEventListener('submit', guardarPerfil);

    $('btn-cambiar-foto').addEventListener('click', function () { $('f-foto').click(); });
    $('f-foto').addEventListener('change', function (e) {
      var archivo = e.target.files[0];
      if (!archivo) return;
      reducirImagen(archivo).then(function (data) {
        fotoPendiente = data;
        pintarAvatar(perfilActual, data);
        $('btn-quitar-foto').hidden = false;
        aviso('perfil-aviso', 'info', 'Foto lista. Presiona "Guardar cambios" para aplicarla.');
      }).catch(function (err) { aviso('perfil-aviso', 'error', err.message); });
      e.target.value = '';
    });
    $('btn-quitar-foto').addEventListener('click', function () {
      fotoPendiente = null;
      pintarAvatar(perfilActual, null);
      $('btn-quitar-foto').hidden = true;
    });

    document.querySelectorAll('[data-setting]').forEach(function (input) {
      input.addEventListener('change', function () { cambiarAjuste(input); });
    });

    cargarPerfil();
    cargarAjustes();
  });
})();
