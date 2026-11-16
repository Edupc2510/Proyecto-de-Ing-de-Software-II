(() => {
  const form = document.getElementById('report-form');
  const trips = document.getElementById('report-trip');
  const button = document.getElementById('report-submit');
  const message = document.getElementById('report-message');
  // El mismo identificador se conserva al reintentar un envío sin respuesta.
  const requestId = crypto.randomUUID();
  fetch('/reports/trips').then(async response => {
    if (response.status === 401) { location.href = '/login'; return; }
    if (!response.ok) throw new Error('No se pudieron cargar tus viajes. Actualiza la página para reintentar.');
    const rows = await response.json();
    trips.replaceChildren(new Option('Selecciona un viaje', ''));
    for (const trip of rows) trips.add(new Option(`${trip.origin} → ${trip.dest} · ${trip.time} · ${trip.role === 'driver' ? 'Conductor' : 'Pasajero'}`, trip.routeId));
    trips.disabled = rows.length === 0;
    button.disabled = rows.length === 0;
    if (!rows.length) message.textContent = 'Aún no tienes viajes vinculados. Publica o reserva un viaje para poder reportarlo.';
    const selected = new URLSearchParams(location.search).get('routeId');
    if (rows.some(row => row.routeId === selected)) trips.value = selected;
  }).catch(error => { message.textContent = error.message; });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    message.textContent = 'Registrando reclamo…';
    try {
      const response = await fetch('/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId: trips.value, category: document.getElementById('report-category').value,
          description: document.getElementById('report-description').value, requestId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar el reclamo.');
      message.textContent = result.message;
      const code = document.getElementById('report-code');
      code.textContent = `Tu código: ${result.code}`;
      code.hidden = false;
      form.hidden = true;
      document.getElementById('report-again').hidden = false;
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
})();
