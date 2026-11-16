// public/js/driverRating.js
// US24 - Calificar conductor después del viaje (vista del pasajero).
//
// Escenarios de la guía:
//   01 Calificación exitosa  → el viaje terminó, el pasajero elige estrellas y se guarda
//   02 Sin viaje finalizado  → el botón queda bloqueado: "Disponible cuando termine el viaje"
//   03 Valor inválido        → no se puede enviar sin elegir de 1 a 5 estrellas (y el servidor también lo valida)
//   04 Calificación duplicada→ un viaje ya calificado muestra sus estrellas y no deja calificar otra vez
//   05 Error de red          → mensaje de error si no hay conexión al enviar
//
// La sección "Califica tus viajes" se agrega por JavaScript debajo de las rutas
// disponibles, así no se modifica dashboard.html (solo el <script> y el <link>).

(() => {
  const MAX_COMMENT_LENGTH = 300;
  const SCORE_LABELS = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

  let trips = [];
  let tripToRate = null;
  let selectedScore = 0;
  let isSubmitting = false;

  function escapeText(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  const shortPlace = (text) => String(text || '').split(',')[0].trim();

  const starsText = (score) => '★'.repeat(score) + '☆'.repeat(5 - score);

  // ─────────────────────────────────────────────────────────────
  // SECCIÓN "CALIFICA TUS VIAJES"
  // ─────────────────────────────────────────────────────────────
  function ensureSection() {
    let section = document.getElementById('rate-trips-section');
    if (section) return section;

    const anchor = document.getElementById('passenger-routes-anchor');
    if (!anchor) return null;

    section = document.createElement('section');
    section.id = 'rate-trips-section';
    section.className = 'rate-trips';
    anchor.insertAdjacentElement('afterend', section);

    section.addEventListener('click', (event) => {
      const button = event.target.closest('.rate-trip__button');
      if (button && !button.disabled) {
        openRatingModal(button.dataset.bookingId);
      }
      if (event.target.closest('[data-action="reload-trips"]')) loadTripsToRate();
    });

    return section;
  }

  function renderTrips() {
    const section = ensureSection();
    if (!section) return;

    const pending = trips.filter(t => t.ratingStatus === 'por_calificar').length;

    const header = `
      <div class="rate-trips__header">
        <h3>Califica tus viajes</h3>
        ${pending > 0 ? `<span class="rate-trips__pending">${pending} por calificar</span>` : ''}
      </div>
    `;

    if (trips.length === 0) {
      section.innerHTML = header + `
        <p class="rate-trips__empty">Cuando reserves un viaje aparecerá aquí para que califiques al conductor al terminar.</p>
      `;
      return;
    }

    section.innerHTML = header + `
      <ul class="rate-trips__list">
        ${trips.map(trip => {
          let action = '';

          if (trip.ratingStatus === 'por_calificar') {
            // Escenario 01: el viaje terminó → se puede calificar
            action = `<button type="button" class="btn btn--primary btn--sm rate-trip__button" data-booking-id="${escapeText(trip.bookingId)}">Calificar</button>`;
          } else if (trip.ratingStatus === 'calificado') {
            // Escenario 04: ya calificó → solo se muestran sus estrellas
            action = `<span class="rate-trip__stars" title="Tu calificación">${starsText(trip.rating?.score || 0)}</span>`;
          } else {
            // Escenario 02: el viaje no terminó → acción bloqueada
            action = `<button type="button" class="btn btn--ghost btn--sm rate-trip__button" disabled
                        title="Podrás calificar cuando termine el viaje">Disponible al terminar</button>`;
          }

          return `
            <li class="rate-trip rate-trip--${escapeText(trip.ratingStatus)}">
              <div class="rate-trip__info">
                <div class="rate-trip__route">${escapeText(shortPlace(trip.origin))} → ${escapeText(shortPlace(trip.dest))}</div>
                <div class="rate-trip__meta">🚗 ${escapeText(trip.driverName)} · 🕒 ${escapeText(trip.time)}</div>
                ${trip.rating?.comment ? `<div class="rate-trip__comment">“${escapeText(trip.rating.comment)}”</div>` : ''}
              </div>
              <div class="rate-trip__action">${action}</div>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  async function loadTripsToRate() {
    const section = ensureSection();
    if (!section) return;

    try {
      const res = await fetch('/ratings/passenger/trips');
      const data = await res.json().catch(() => []);

      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar tus viajes.');

      trips = Array.isArray(data) ? data : [];
      renderTrips();
    } catch (error) {
      console.error('[US24] Error cargando viajes:', error);
      section.innerHTML = `
        <div class="rate-trips__header"><h3>Califica tus viajes</h3></div>
        <p class="rate-trips__empty rate-trips__empty--error">
          ⚠️ No se pudieron cargar tus viajes.
          <button type="button" class="rate-trips__retry" data-action="reload-trips">Reintentar</button>
        </p>
      `;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VENTANA PARA CALIFICAR
  // ─────────────────────────────────────────────────────────────
  function ensureModal() {
    let overlay = document.getElementById('rating-modal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'rating-modal';
    overlay.className = 'requests-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="requests-modal" role="dialog" aria-modal="true" aria-labelledby="rating-modal-title">
        <div class="requests-modal__header">
          <div>
            <h2 id="rating-modal-title">Califica a tu conductor</h2>
            <p id="rating-modal-trip">--</p>
          </div>
          <button type="button" class="requests-modal__close" data-action="close" aria-label="Cerrar">×</button>
        </div>

        <div class="requests-modal__body rating-modal__body">
          <p class="rating-modal__question">¿Cómo fue tu viaje con <strong id="rating-modal-driver">el conductor</strong>?</p>

          <div class="rating-stars" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
            ${[1, 2, 3, 4, 5].map(n => `
              <button type="button" class="rating-star" data-score="${n}" role="radio" aria-checked="false"
                aria-label="${n} estrella${n === 1 ? '' : 's'}">★</button>
            `).join('')}
          </div>
          <div id="rating-score-label" class="rating-score-label">Elige de 1 a 5 estrellas</div>

          <label class="cancel-field" for="rating-comment">
            <span>Comentario <span class="cancel-field__optional">(opcional)</span></span>
            <textarea id="rating-comment" rows="3" maxlength="${MAX_COMMENT_LENGTH}"
              placeholder="Ej: Muy puntual y manejó con cuidado"></textarea>
            <span id="rating-comment-count" class="rating-comment-count">0 / ${MAX_COMMENT_LENGTH}</span>
          </label>

          <div id="rating-error" class="form-message form-message--error" style="display:none;"></div>

          <div class="cancel-actions">
            <button type="button" class="btn btn--ghost" data-action="close">Ahora no</button>
            <button type="button" id="rating-submit" class="btn btn--primary" disabled>Enviar calificación</button>
          </div>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeRatingModal();
      if (event.target.closest('[data-action="close"]')) closeRatingModal();

      const star = event.target.closest('.rating-star');
      if (star) setScore(Number(star.dataset.score));
    });

    // Vista previa al pasar el mouse por las estrellas
    overlay.addEventListener('mouseover', (event) => {
      const star = event.target.closest('.rating-star');
      if (star) paintStars(Number(star.dataset.score));
    });
    overlay.querySelector('.rating-stars').addEventListener('mouseleave', () => paintStars(selectedScore));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.hidden) closeRatingModal();
    });

    const comment = overlay.querySelector('#rating-comment');
    comment.addEventListener('input', () => {
      overlay.querySelector('#rating-comment-count').textContent = `${comment.value.length} / ${MAX_COMMENT_LENGTH}`;
    });

    overlay.querySelector('#rating-submit').addEventListener('click', submitRating);

    document.body.appendChild(overlay);
    return overlay;
  }

  function paintStars(score) {
    document.querySelectorAll('#rating-modal .rating-star').forEach(star => {
      star.classList.toggle('rating-star--active', Number(star.dataset.score) <= score);
    });
  }

  function setScore(score) {
    // Escenario 03: solo se aceptan enteros de 1 a 5
    if (!Number.isInteger(score) || score < 1 || score > 5) return;

    selectedScore = score;
    paintStars(score);

    document.querySelectorAll('#rating-modal .rating-star').forEach(star => {
      star.setAttribute('aria-checked', String(Number(star.dataset.score) === score));
    });

    document.getElementById('rating-score-label').textContent = `${score} de 5 · ${SCORE_LABELS[score]}`;
    document.getElementById('rating-submit').disabled = isSubmitting;
    document.getElementById('rating-error').style.display = 'none';
  }

  function showError(message) {
    const errorEl = document.getElementById('rating-error');
    errorEl.textContent = `⚠️ ${message}`;
    errorEl.style.display = 'flex';
  }

  function openRatingModal(bookingId) {
    const trip = trips.find(t => t.bookingId === bookingId);
    if (!trip || trip.ratingStatus !== 'por_calificar') return;

    const overlay = ensureModal();
    tripToRate = trip;
    selectedScore = 0;
    isSubmitting = false;

    document.getElementById('rating-modal-trip').textContent =
      `${shortPlace(trip.origin)} → ${shortPlace(trip.dest)} · ${trip.time}`;
    document.getElementById('rating-modal-driver').textContent = trip.driverName;
    document.getElementById('rating-score-label').textContent = 'Elige de 1 a 5 estrellas';
    document.getElementById('rating-comment').value = '';
    document.getElementById('rating-comment-count').textContent = `0 / ${MAX_COMMENT_LENGTH}`;
    document.getElementById('rating-error').style.display = 'none';

    const submit = document.getElementById('rating-submit');
    submit.disabled = true;
    submit.textContent = 'Enviar calificación';

    paintStars(0);
    overlay.hidden = false;
  }

  function closeRatingModal() {
    const overlay = document.getElementById('rating-modal');
    if (overlay) overlay.hidden = true;
    tripToRate = null;
  }

  async function submitRating() {
    if (!tripToRate || isSubmitting) return;

    if (selectedScore < 1 || selectedScore > 5) {
      showError('Selecciona una calificación de 1 a 5 estrellas.');
      return;
    }

    const submit = document.getElementById('rating-submit');
    const comment = document.getElementById('rating-comment').value.trim().slice(0, MAX_COMMENT_LENGTH);

    isSubmitting = true;
    submit.disabled = true;
    submit.textContent = 'Enviando...';

    try {
      const res = await fetch('/ratings/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: tripToRate.bookingId, score: selectedScore, comment })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Escenarios 02, 03 y 04 también se validan en el servidor
        showError(data.error || 'No se pudo guardar la calificación.');
        if (res.status === 409) loadTripsToRate(); // por si ya estaba calificado
        return;
      }

      closeRatingModal();
      await loadTripsToRate();
      alert(`⭐ ${data.message || '¡Gracias! Tu calificación fue registrada.'}`);

    } catch (error) {
      // Escenario 05: error de red
      console.error('[US24] Error enviando calificación:', error);
      showError('No hay conexión con el servidor. Tu calificación no se envió, inténtalo de nuevo.');
    } finally {
      isSubmitting = false;
      if (!document.getElementById('rating-modal').hidden) {
        submit.textContent = 'Enviar calificación';
        submit.disabled = selectedScore < 1;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CONEXIÓN CON EL DASHBOARD (sin modificar dashboard.js)
  // ─────────────────────────────────────────────────────────────
  // loadPassengerRoutes() se ejecuta al entrar como pasajero (desde selectRole)
  // y después de cada reserva, así que al envolverla la lista de viajes
  // siempre queda actualizada sin tocar dashboard.js.
  function wrapGlobal(name, after) {
    const original = window[name];
    if (typeof original !== 'function') return;

    window[name] = function (...args) {
      const result = original.apply(this, args);
      Promise.resolve(result).finally(() => after(...args));
      return result;
    };
  }

  wrapGlobal('loadPassengerRoutes', () => loadTripsToRate());

  window.loadTripsToRate = loadTripsToRate;
})();
