(() => {
  let initialized = false;
  let debounceTimers = {};
  let abortControllers = {};

  const MIN_QUERY_LENGTH = 3;
  const SEARCH_DELAY_MS = 500;

  const fields = {
    origin: {
      inputId: 'd-origin',
      resultsId: 'origin-search-results',
      setFn: 'setDriverOriginLocation',
      clearFn: 'clearDriverOriginLocation',
      errorLabel: 'origen'
    },
    dest: {
      inputId: 'd-dest',
      resultsId: 'dest-search-results',
      setFn: 'setDriverDestinationLocation',
      clearFn: 'clearDriverDestinationLocation',
      errorLabel: 'destino'
    }
  };

  window.initDriverAddressSearch = function initDriverAddressSearch() {
    if (initialized) return;
    initialized = true;

    Object.entries(fields).forEach(([type, config]) => {
      initField(type, config);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.address-search')) {
        Object.values(fields).forEach(config => {
          const resultsContainer = document.getElementById(config.resultsId);
          if (resultsContainer) resultsContainer.hidden = true;
        });
      }
    });
  };

  function initField(type, config) {
    const input = document.getElementById(config.inputId);
    const resultsContainer = document.getElementById(config.resultsId);

    if (!input || !resultsContainer) return;

    input.addEventListener('input', () => {
      const query = input.value.trim();

      if (typeof window[config.clearFn] === 'function') {
        window[config.clearFn]({ keepInput: true });
      }

      clearTimeout(debounceTimers[type]);

      if (query.length < MIN_QUERY_LENGTH) {
        clearResults(resultsContainer);
        return;
      }

      debounceTimers[type] = setTimeout(() => {
        searchAddress(type, query, resultsContainer, config);
      }, SEARCH_DELAY_MS);
    });

    input.addEventListener('focus', () => {
      if (resultsContainer.children.length > 0) {
        resultsContainer.hidden = false;
      }
    });
  }

  async function searchAddress(type, query, resultsContainer, config) {
    try {
      if (abortControllers[type]) {
        abortControllers[type].abort();
      }

      abortControllers[type] = new AbortController();

      showLoading(resultsContainer);

      const url =
        'https://nominatim.openstreetmap.org/search' +
        `?format=jsonv2` +
        `&q=${encodeURIComponent(query)}` +
        `&countrycodes=pe` +
        `&viewbox=-77.20,-12.25,-76.75,-11.80` +
        `&bounded=1` +
        `&limit=6` +
        `&addressdetails=1`;

      const response = await fetch(url, {
        signal: abortControllers[type].signal,
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('No se pudo buscar la dirección.');
      }

      const results = await response.json();
      renderResults(results, resultsContainer, config);

    } catch (error) {
      if (error.name === 'AbortError') return;

      console.error(`[AddressSearch] Error buscando ${config.errorLabel}:`, error);
      showError(resultsContainer, 'No se pudo buscar la dirección.');
    }
  }

  function renderResults(results, resultsContainer, config) {
    if (!Array.isArray(results) || results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="address-search-empty">
          No se encontraron direcciones. Intenta ser más específico.
        </div>
      `;
      resultsContainer.hidden = false;
      return;
    }

    resultsContainer.innerHTML = results.map((result, index) => {
      const name = result.display_name || 'Dirección sin nombre';

      return `
        <button type="button" class="address-search-item" data-index="${index}">
          <span class="address-search-item__icon">📍</span>
          <span class="address-search-item__text">${escapeHTML(name)}</span>
        </button>
      `;
    }).join('');

    resultsContainer.querySelectorAll('.address-search-item').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const selected = results[index];

        if (!selected) return;

        const addressName = selected.display_name;
        const lat = Number(selected.lat);
        const lng = Number(selected.lon);

        if (typeof window[config.setFn] !== 'function') {
          alert('No se pudo conectar la dirección con el mapa.');
          return;
        }

        const wasSelected = window[config.setFn](addressName, lat, lng);

        if (!wasSelected) {
          alert('La dirección seleccionada no tiene coordenadas válidas.');
          return;
        }

        clearResults(resultsContainer);
      });
    });

    resultsContainer.hidden = false;
  }

  function showLoading(resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="address-search-empty">
        Buscando direcciones...
      </div>
    `;
    resultsContainer.hidden = false;
  }

  function showError(resultsContainer, message) {
    resultsContainer.innerHTML = `
      <div class="address-search-empty address-search-empty--error">
        ${escapeHTML(message)}
      </div>
    `;
    resultsContainer.hidden = false;
  }

  function clearResults(resultsContainer) {
    resultsContainer.innerHTML = '';
    resultsContainer.hidden = true;
  }

  function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }
})();