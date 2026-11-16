// public/js/misViajes.js
// Frontend de la vista "Mis viajes" del pasajero:
//   US15 · Estado de solicitudes      -> /requests
//   US17 · Reservas realizadas        -> /reservations
//   US35 · Confirmar participación    -> /reservations/:id/participation/*
//   US30 · Conductores frecuentes     -> /frequent-drivers
//   US37 · Estado del reclamo         -> /claims

(() => {
  'use strict';

  const state = {
    tab: 'solicitudes',
    filtroSolicitudes: 'todas',
    filtroReservas: 'proximas',
    conductores: [],
  };

  const $ = id => document.getElementById(id);

  // ───────────────────────── Utilidades ─────────────────────────

  function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function api(url, opciones = {}) {
    const res = await fetch(url, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(opciones.headers || {}) },
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('Sesión expirada.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'Ocurrió un error.');
    return data;
  }

  let toastTimer;
  function toast(mensaje, esError = false) {
    const el = $('mv-toast');
    el.textContent = mensaje;
    el.className = `mv-toast${esError ? ' mv-toast--error' : ''}`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  const pill = (tono, etiqueta) => `<span class="mv-pill mv-pill--${esc(tono || 'neutral')}">${esc(etiqueta)}</span>`;

  function fecha(iso, conHora = true) {
    if (!iso) return '--';
    const opciones = { day: '2-digit', month: 'short', year: 'numeric' };
    if (conHora) Object.assign(opciones, { hour: '2-digit', minute: '2-digit' });
    return new Date(iso).toLocaleString('es-PE', opciones);
  }

  function tiempoRelativo(minutos) {
    if (minutos == null) return '';
    const abs = Math.abs(minutos);
    const texto = abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} días`;
    return minutos >= 0 ? `Sale en ${texto}` : `Salió hace ${texto}`;
  }

  function rutaHTML(route) {
    return `
      <div class="mv-route">
        <div class="mv-route__stop"><span class="mv-route__dot mv-route__dot--origin"></span>${esc(route?.origin)}</div>
        <div class="mv-route__stop"><span class="mv-route__dot mv-route__dot--dest"></span>${esc(route?.dest)}</div>
      </div>`;
  }

  const vacio = (titulo, texto) => `<div class="mv-empty"><strong>${esc(titulo)}</strong>${esc(texto)}</div>`;

  function abrirModal(titulo, html) {
    $('mv-modal-title').textContent = titulo;
    $('mv-modal-body').innerHTML = html;
    $('mv-modal').hidden = false;
  }

  function cerrarModal() {
    $('mv-modal').hidden = true;
    $('mv-modal-body').innerHTML = '';
  }

  function setCount(id, valor) {
    $(id).textContent = valor ? String(valor) : '';
  }

  // ───────────────────────── Tabs ─────────────────────────

  const CARGADORES = {
    solicitudes: () => cargarSolicitudes(),
    reservas: () => cargarReservas(),
    conductores: () => cargarConductores(),
    reclamos: () => cargarReclamos(),
  };

  function mostrarTab(tab) {
    if (!CARGADORES[tab]) tab = 'solicitudes';
    state.tab = tab;
    document.querySelectorAll('.mv-tab').forEach(b => b.classList.toggle('mv-tab--active', b.dataset.tab === tab));
    document.querySelectorAll('.mv-panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
    history.replaceState(null, '', `#${tab}`);
    CARGADORES[tab]();
  }

  // ───────────────────────── US15 · Solicitudes ─────────────────────────

  function pasosSolicitud(paso) {
    const nombres = ['Enviada', 'En revisión', 'Respuesta'];
    return `<div class="mv-steps">${nombres.map((n, i) => `
      <div class="mv-steps__item ${i + 1 <= paso ? 'mv-steps__item--done' : ''} ${i + 1 === paso ? 'mv-steps__item--current' : ''}">
        <div class="mv-steps__bar"></div>${n}
      </div>`).join('')}</div>`;
  }

  async function cargarSolicitudes() {
    const lista = $('lista-solicitudes');
    try {
      const data = await api(`/requests?estado=${encodeURIComponent(state.filtroSolicitudes)}`);
      setCount('count-solicitudes', data.resumen.pendiente);

      $('resumen-solicitudes').innerHTML = [
        ['pendiente', 'pendientes'], ['aceptada', 'aceptadas'], ['rechazada', 'rechazadas'], ['expirada', 'expiradas'],
      ].map(([k, label]) => `<div class="mv-summary__item"><strong>${data.resumen[k] || 0}</strong>${label}</div>`).join('');

      if (!data.solicitudes.length) {
        lista.innerHTML = vacio('No hay solicitudes para mostrar', 'Cuando pidas unirte a una ruta, aquí verás si el conductor la aceptó.');
        return;
      }

      lista.innerHTML = data.solicitudes.map(s => `
        <article class="mv-card">
          <div class="mv-card__top">
            <div>
              <div class="mv-card__title">${esc(s.driver.name)}</div>
              <div class="mv-card__meta">Salida: ${fecha(s.route.departureAt)} · ${s.seatsRequested} asiento(s)</div>
            </div>
            ${pill(s.estado.tono, s.estado.etiqueta)}
          </div>
          ${rutaHTML(s.route)}
          ${pasosSolicitud(s.estado.paso)}
          <p class="mv-card__desc">${esc(s.descripcion)}</p>
          <div class="mv-card__actions">
            <button class="btn btn--ghost btn--sm" data-action="detalle-solicitud" data-id="${esc(s.id)}">Ver historial</button>
            ${s.estado.puedeCancelar ? `<button class="btn btn--ghost btn--sm" data-action="cancelar-solicitud" data-id="${esc(s.id)}">Cancelar solicitud</button>` : ''}
          </div>
        </article>`).join('');
    } catch (error) {
      lista.innerHTML = vacio('No pudimos cargar tus solicitudes', error.message);
    }
  }

  async function detalleSolicitud(id) {
    try {
      const { solicitud: s } = await api(`/requests/${encodeURIComponent(id)}`);
      abrirModal('Historial de la solicitud', `
        <div>${pill(s.estado.tono, s.estado.etiqueta)}</div>
        ${rutaHTML(s.route)}
        <div class="mv-box"><h4>Conductor</h4>${esc(s.driver.name)} · Salida ${fecha(s.route.departureAt)}</div>
        ${s.message ? `<div class="mv-box"><h4>Tu mensaje</h4>${esc(s.message)}</div>` : ''}
        <p>${esc(s.descripcion)}</p>
        <ul class="mv-timeline">${s.historial.slice().reverse().map(h => `
          <li><strong>${esc(h.etiqueta)}</strong><div class="mv-timeline__date">${fecha(h.at)}</div>${h.note ? `<div>${esc(h.note)}</div>` : ''}</li>`).join('')}
        </ul>`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function cancelarSolicitud(id) {
    if (!window.confirm('¿Seguro que deseas cancelar esta solicitud?')) return;
    try {
      const data = await api(`/requests/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      toast(data.message);
      cargarSolicitudes();
    } catch (error) {
      toast(error.message, true);
    }
  }

  // ───────────────────────── US17 / US35 · Reservas ─────────────────────────

  async function cargarReservas() {
    const lista = $('lista-reservas');
    try {
      const data = await api(`/reservations?filtro=${encodeURIComponent(state.filtroReservas)}`);
      setCount('count-reservas', data.contadores.proximas);

      $('filtros-reservas').innerHTML = data.filtros.map(f => `
        <button class="mv-chip ${f.clave === data.filtro ? 'mv-chip--active' : ''}" data-action="filtro-reservas" data-filtro="${esc(f.clave)}">
          ${esc(f.etiqueta)} (${data.contadores[f.clave] || 0})
        </button>`).join('');

      if (!data.reservas.length) {
        lista.innerHTML = vacio('No tienes reservas en esta sección', 'Tus viajes reservados aparecerán aquí.');
        return;
      }

      lista.innerHTML = data.reservas.map(r => `
        <article class="mv-card ${r.requiereConfirmacion ? 'mv-card--highlight' : ''}">
          <div class="mv-card__top">
            <div>
              <div class="mv-card__title">${fecha(r.route.departureAt)}</div>
              <div class="mv-card__meta">${esc(tiempoRelativo(r.minutosParaSalida))}${r.price != null ? ` · S/ ${Number(r.price).toFixed(2)}` : ''}</div>
            </div>
            ${pill(r.estado.tono, r.estado.etiqueta)}
          </div>
          ${rutaHTML(r.route)}
          <div class="mv-card__meta">Conductor: <strong>${esc(r.driver.name)}</strong>${r.driver.vehicle ? ` · ${esc(r.driver.vehicle)}` : ''}</div>
          ${r.cancelReason ? `<p class="mv-card__desc">Motivo de cancelación: ${esc(r.cancelReason)}</p>` : ''}
          ${r.estado.codigo === 'confirmada' ? `
            <div class="mv-card__meta">Participación: ${pill(r.participacion.tono, r.participacion.etiqueta)}</div>
            ${r.requiereConfirmacion ? '<p class="mv-card__desc">⚠️ Tu viaje sale pronto. Confirma tu asistencia para que el conductor te espere.</p>' : ''}
            <div class="mv-card__actions">
              ${r.acciones.puedeConfirmar ? `<button class="btn btn--primary btn--sm" data-action="confirmar-participacion" data-id="${esc(r.id)}">Confirmar asistencia</button>` : ''}
              ${r.acciones.puedeDeclinar ? `<button class="btn btn--ghost btn--sm" data-action="declinar-participacion" data-id="${esc(r.id)}">No podré ir</button>` : ''}
              ${r.acciones.puedeDeshacer ? `<button class="btn btn--ghost btn--sm" data-action="deshacer-participacion" data-id="${esc(r.id)}">↶ Deshacer</button>` : ''}
            </div>` : ''}
        </article>`).join('');
    } catch (error) {
      lista.innerHTML = vacio('No pudimos cargar tus reservas', error.message);
    }
  }

  async function accionParticipacion(id, accion, cuerpo) {
    try {
      const data = await api(`/reservations/${encodeURIComponent(id)}/participation/${accion}`, {
        method: 'POST',
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      toast(data.message);
      cerrarModal();
      cargarReservas();
    } catch (error) {
      toast(error.message, true);
    }
  }

  function abrirDeclinar(id) {
    abrirModal('¿No podrás asistir?', `
      <p>Le avisaremos al conductor para que pueda reorganizar su viaje. Podrás deshacerlo antes de la salida.</p>
      <div class="form-group">
        <label class="form-label" for="motivo-declinar">Motivo <span class="label-optional">(opcional)</span></label>
        <textarea class="form-input form-textarea" id="motivo-declinar" maxlength="200" placeholder="Ej: Se canceló mi clase"></textarea>
      </div>
      <div class="mv-card__actions">
        <button class="btn btn--ghost btn--sm" data-close-modal>Volver</button>
        <button class="btn btn--primary btn--sm" data-action="enviar-declinar" data-id="${esc(id)}">Confirmar que no iré</button>
      </div>`);
  }

  // ───────────────────────── US30 · Conductores frecuentes ─────────────────────────

  async function cargarConductores() {
    const lista = $('lista-conductores');
    try {
      const data = await api('/frequent-drivers');
      state.conductores = data.conductores;
      setCount('count-conductores', data.conductores.length);
      $('hint-conductores').textContent = `Conductores con quienes completaste ${data.minimoViajes} o más viajes.`;

      if (!data.conductores.length) {
        lista.innerHTML = vacio('Aún no tienes conductores frecuentes', `Cuando completes ${data.minimoViajes} viajes con un mismo conductor, podrás contactarlo desde aquí.`);
        return;
      }

      lista.innerHTML = data.conductores.map(c => `
        <article class="mv-card">
          <div class="mv-card__top">
            <div>
              <div class="mv-card__title">${esc(c.name)}</div>
              <div class="mv-card__meta">${esc(c.vehicle || 'Vehículo no registrado')}</div>
            </div>
            ${pill('info', `${c.viajesCompartidos} viajes`)}
          </div>
          ${c.rutaFrecuente ? `<div class="mv-card__meta">Ruta frecuente: ${esc(c.rutaFrecuente)}</div>` : ''}
          <div class="mv-card__meta">Último viaje: ${fecha(c.ultimoViaje, false)}${c.ultimoContacto ? ` · Último contacto: ${fecha(c.ultimoContacto)}` : ''}</div>
          <div class="mv-card__actions">
            <button class="btn btn--primary btn--sm" data-action="contactar" data-id="${esc(c.driverId)}">Contactar</button>
          </div>
        </article>`).join('');
    } catch (error) {
      lista.innerHTML = vacio('No pudimos cargar tus conductores frecuentes', error.message);
    }
  }

  async function abrirContacto(driverId) {
    const conductor = state.conductores.find(c => c.driverId === driverId);
    if (!conductor) return;
    const primerDisponible = conductor.canales.find(c => c.disponible);

    abrirModal(`Contactar a ${conductor.name}`, `
      <p class="mv-card__meta">Por tu seguridad, solo puedes contactar a conductores con los que ya viajaste.</p>
      <div class="mv-channels">
        ${conductor.canales.map(c => `
          <button class="mv-channel ${c.clave === primerDisponible?.clave ? 'mv-channel--active' : ''}" data-action="elegir-canal" data-canal="${esc(c.clave)}" ${c.disponible ? '' : 'disabled title="No disponible para este conductor"'}>
            ${esc(c.etiqueta)}
          </button>`).join('')}
      </div>
      <div class="form-group">
        <label class="form-label" for="mensaje-contacto">Mensaje <span class="label-optional">(máx. 300 caracteres)</span></label>
        <textarea class="form-input form-textarea" id="mensaje-contacto" maxlength="300" placeholder="Hola, ¿tienes cupo para mañana a las 7:00 a. m.?"></textarea>
      </div>
      <button class="btn btn--primary btn--full" data-action="enviar-contacto" data-id="${esc(driverId)}">Contactar</button>
      <div class="mv-box"><h4>Historial de contacto</h4><div id="historial-contacto">Cargando...</div></div>`);

    try {
      const data = await api(`/frequent-drivers/${encodeURIComponent(driverId)}/contacts`);
      const cont = $('historial-contacto');
      if (cont) {
        cont.innerHTML = data.contactos.length
          ? `<ul class="mv-timeline">${data.contactos.map(c => `
              <li><strong>${esc(c.canal)}</strong><div class="mv-timeline__date">${fecha(c.createdAt)}</div>${c.texto ? esc(c.texto) : ''}</li>`).join('')}</ul>`
          : 'Aún no lo has contactado.';
      }
    } catch (error) {
      const cont = $('historial-contacto');
      if (cont) cont.textContent = error.message;
    }
  }

  async function enviarContacto(driverId) {
    const canal = document.querySelector('.mv-channel--active')?.dataset.canal;
    if (!canal) return toast('Elige un canal de contacto.', true);
    try {
      const data = await api(`/frequent-drivers/${encodeURIComponent(driverId)}/contact`, {
        method: 'POST',
        body: JSON.stringify({ canal, mensaje: $('mensaje-contacto').value }),
      });
      toast(data.message);
      const { contacto } = data;
      if (contacto.tipo === 'enlace' && contacto.url) {
        if (contacto.url.startsWith('https://')) window.open(contacto.url, '_blank', 'noopener');
        else window.location.href = contacto.url;
      }
      cerrarModal();
      cargarConductores();
    } catch (error) {
      toast(error.message, true);
    }
  }

  // ───────────────────────── US37 · Reclamos ─────────────────────────

  function slaHTML(t) {
    if (!t) return '';
    const texto = t.vencido
      ? 'Plazo de respuesta vencido: lo estamos priorizando.'
      : t.horasRestantes > 0 ? `Respuesta estimada antes de ${fecha(t.fechaLimite)} (${t.horasRestantes} h restantes)` : 'Atendido dentro del plazo.';
    return `<div class="mv-sla ${t.vencido ? 'mv-sla--late' : ''}">${esc(texto)}<div class="mv-sla__bar"><div class="mv-sla__fill" style="width:${Number(t.avance) || 0}%"></div></div></div>`;
  }

  /** Lee los 5 campos del formulario de búsqueda (todos opcionales). */
  function criteriosReclamos() {
    const params = new URLSearchParams();
    ['codigo', 'estado', 'categoria', 'desde', 'hasta'].forEach(campo => {
      const valor = $(`f-${campo}`).value.trim();
      if (valor) params.set(campo, valor);
    });
    return params;
  }

  function llenarSelect(id, opciones, valorClave, primera) {
    const select = $(id);
    if (select.options.length > 1) return; // ya está cargado
    select.innerHTML = `<option value="${primera.valor}">${esc(primera.etiqueta)}</option>`
      + opciones.map(o => `<option value="${esc(o[valorClave])}">${esc(o.etiqueta)}</option>`).join('');
  }

  async function cargarReclamos() {
    const lista = $('lista-reclamos');
    const error = $('error-reclamos');
    error.style.display = 'none';
    try {
      const params = criteriosReclamos();
      const data = await api(`/claims${params.toString() ? `?${params}` : ''}`);
      setCount('count-reclamos', data.abiertos);
      llenarSelect('f-estado', data.estados, 'codigo', { valor: 'todos', etiqueta: 'Todos' });
      llenarSelect('f-categoria', data.categorias, 'clave', { valor: 'todas', etiqueta: 'Todas' });
      $('resumen-reclamos').innerHTML = `
        <div class="mv-summary__item"><strong>${data.total}</strong>reclamos</div>
        <div class="mv-summary__item"><strong>${data.abiertos}</strong>en atención</div>
        <div class="mv-summary__item"><strong>${data.cerrados}</strong>finalizados</div>
        ${params.toString() ? `<div class="mv-summary__item"><strong>${data.encontrados}</strong>coinciden con la búsqueda</div>` : ''}`;

      if (!data.reclamos.length) {
        lista.innerHTML = data.total
          ? vacio('Ningún reclamo coincide con la búsqueda', 'Prueba con otros criterios o pulsa "Limpiar".')
          : vacio('No tienes reclamos registrados', 'Si registras un reclamo, aquí podrás seguir su estado.');
        return;
      }

      lista.innerHTML = data.reclamos.map(r => `
        <article class="mv-card">
          <div class="mv-card__top">
            <div>
              <div class="mv-card__title">${esc(r.asunto)}</div>
              <div class="mv-card__meta">${esc(r.codigo)} · ${esc(r.categoria.etiqueta)} · Registrado ${fecha(r.fechaRegistro, false)}</div>
            </div>
            ${pill(r.estado.tono, r.estado.etiqueta)}
          </div>
          <p class="mv-card__desc">${esc(r.estado.descripcion)}</p>
          ${slaHTML(r.tiempoRespuesta)}
          <div class="mv-card__actions">
            <button class="btn btn--ghost btn--sm" data-action="detalle-reclamo" data-id="${esc(r.codigo)}">Ver seguimiento</button>
          </div>
        </article>`).join('');
    } catch (e) {
      // Un criterio inválido se muestra junto al formulario; la lista queda vacía.
      error.textContent = e.message;
      error.style.display = 'block';
      $('resumen-reclamos').innerHTML = '';
      lista.innerHTML = '';
    }
  }

  async function detalleReclamo(codigo) {
    try {
      const { reclamo: r } = await api(`/claims/${encodeURIComponent(codigo)}`);
      const lt = r.lineaDeTiempo;
      abrirModal(`Reclamo ${r.codigo}`, `
        <div class="mv-card__top">
          <div><div class="mv-card__title">${esc(r.asunto)}</div><div class="mv-card__meta">${esc(r.categoria.etiqueta)} · Prioridad ${esc(r.prioridad)}</div></div>
          ${pill(r.estado.tono, r.estado.etiqueta)}
        </div>
        <div class="mv-steps">${lt.pasos.map(p => `
          <div class="mv-steps__item ${p.completado ? 'mv-steps__item--done' : ''} ${p.actual ? 'mv-steps__item--current' : ''}">
            <div class="mv-steps__bar"></div>${esc(p.etiqueta)}
          </div>`).join('')}</div>
        <p>${esc(r.estado.descripcion)}</p>
        ${slaHTML(r.tiempoRespuesta)}
        <div class="mv-box"><h4>Tu reclamo</h4>${esc(r.descripcion)}</div>
        ${r.viaje ? `<div class="mv-box"><h4>Viaje asociado</h4>${esc(r.viaje.origen)} → ${esc(r.viaje.destino)}<br>${fecha(r.viaje.salida)} · ${esc(r.viaje.conductor)}</div>` : ''}
        <div class="mv-box"><h4>Soporte · ${esc(r.soporte.agente)}</h4>${r.soporte.respuesta ? esc(r.soporte.respuesta) : 'Aún no hay una respuesta final.'}</div>
        <div><strong>Movimientos</strong>
          <ul class="mv-timeline">${lt.eventos.map(e => `
            <li><strong>${esc(e.etiqueta)}</strong><div class="mv-timeline__date">${fecha(e.at)}</div>${e.note ? esc(e.note) : ''}</li>`).join('')}
          </ul>
        </div>`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  // ───────────────────────── Eventos ─────────────────────────

  const ACCIONES = {
    'detalle-solicitud': el => detalleSolicitud(el.dataset.id),
    'cancelar-solicitud': el => cancelarSolicitud(el.dataset.id),
    'filtro-reservas': el => { state.filtroReservas = el.dataset.filtro; cargarReservas(); },
    'confirmar-participacion': el => accionParticipacion(el.dataset.id, 'confirm'),
    'declinar-participacion': el => abrirDeclinar(el.dataset.id),
    'enviar-declinar': el => accionParticipacion(el.dataset.id, 'decline', { motivo: $('motivo-declinar')?.value }),
    'deshacer-participacion': el => accionParticipacion(el.dataset.id, 'undo'),
    contactar: el => abrirContacto(el.dataset.id),
    'elegir-canal': el => {
      document.querySelectorAll('.mv-channel').forEach(b => b.classList.toggle('mv-channel--active', b === el));
    },
    'enviar-contacto': el => enviarContacto(el.dataset.id),
    'detalle-reclamo': el => detalleReclamo(el.dataset.id),
  };

  document.addEventListener('click', event => {
    const accion = event.target.closest('[data-action]');
    if (accion && ACCIONES[accion.dataset.action]) {
      event.preventDefault();
      ACCIONES[accion.dataset.action](accion);
      return;
    }
    if (event.target.closest('[data-close-modal]') || event.target.id === 'mv-modal') cerrarModal();
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

  document.querySelectorAll('.mv-tab').forEach(btn => btn.addEventListener('click', () => mostrarTab(btn.dataset.tab)));

  $('filtro-solicitudes').addEventListener('change', e => {
    state.filtroSolicitudes = e.target.value;
    cargarSolicitudes();
  });

  $('form-buscar-reclamo').addEventListener('submit', e => {
    e.preventDefault();
    cargarReclamos();
  });

  $('btn-limpiar-reclamos').addEventListener('click', () => {
    $('form-buscar-reclamo').reset();
    cargarReclamos();
  });

  $('mv-demo-btn').addEventListener('click', async () => {
    if (!window.confirm('Se generarán solicitudes, reservas y reclamos de ejemplo para tu usuario (reemplaza los datos de demo anteriores). ¿Continuar?')) return;
    try {
      const data = await api('/mis-viajes/demo', { method: 'POST' });
      toast(data.message);
      await cargarContadores();
      CARGADORES[state.tab]();
    } catch (error) {
      toast(error.message, true);
    }
  });

  async function cargarContadores() {
    const pedidos = [
      api('/requests').then(d => setCount('count-solicitudes', d.resumen.pendiente)),
      api('/reservations?filtro=proximas').then(d => setCount('count-reservas', d.contadores.proximas)),
      api('/frequent-drivers').then(d => { state.conductores = d.conductores; setCount('count-conductores', d.conductores.length); }),
      api('/claims').then(d => setCount('count-reclamos', d.abiertos)),
    ];
    await Promise.allSettled(pedidos);
  }

  async function cargarSaludo() {
    try {
      const data = await api('/auth/me');
      $('mv-greeting').textContent = `Hola, ${data.user.firstName}. Revisa tus solicitudes, reservas, conductores frecuentes y reclamos.`;
    } catch { /* el saludo es opcional */ }
  }

  // ───────────────────────── Inicio ─────────────────────────
  cargarSaludo();
  cargarContadores();
  mostrarTab(window.location.hash.replace('#', '') || 'solicitudes');
})();
