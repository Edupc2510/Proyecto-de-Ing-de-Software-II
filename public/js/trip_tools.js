let appliedTripFilters = new URLSearchParams();
function getTripFilterQuery() { return appliedTripFilters.toString(); }

const tripFilterForm = document.getElementById('trip-filters');
tripFilterForm.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(tripFilterForm);
  const from = data.get('timeFrom');
  const to = data.get('timeTo');
  const message = document.getElementById('trip-filter-message');
  if (from && to && from > to) {
    message.textContent = 'La hora inicial no puede ser posterior a la final.';
    return;
  }
  appliedTripFilters = new URLSearchParams();
  for (const [key, value] of data) if (value) appliedTripFilters.set(key, value);
  message.textContent = 'Filtros aplicados. Los horarios incluyen los extremos del intervalo.';
  loadPassengerRoutes();
});
tripFilterForm.addEventListener('reset', () => {
  appliedTripFilters = new URLSearchParams();
  document.getElementById('trip-filter-message').textContent = 'Filtros limpiados.';
  loadPassengerRoutes();
});

let editingTripId = null;
function openTripDetailsEditor(route) {
  editingTripId = String(route.id);
  document.getElementById('details-trip-name').textContent = `${route.origin} → ${route.dest}`;
  document.getElementById('details-notes').value = route.notes || '';
  document.getElementById('details-message').textContent = '';
  document.getElementById('trip-details-editor').showModal();
}
document.getElementById('details-close').addEventListener('click', () => {
  document.getElementById('trip-details-editor').close();
});
document.getElementById('trip-details-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('details-save');
  if (button.disabled) return;
  button.disabled = true;
  const message = document.getElementById('details-message');
  try {
    const response = await fetch(`/trips/${encodeURIComponent(editingTripId)}/details`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: document.getElementById('details-notes').value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron guardar los detalles.');
    message.textContent = result.message;
    await loadDriverPublishedRoutes();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
