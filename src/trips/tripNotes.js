const MAX_NOTES_LENGTH = 500;
function validateNotes(notes, required = true) {
  if (typeof notes !== 'string') return 'Los detalles deben ser texto.';
  if (required && !notes.trim()) return 'Escribe los detalles del viaje.';
  if (notes.trim().length > MAX_NOTES_LENGTH) return 'Los detalles pueden tener hasta 500 caracteres.';
  return null;
}

module.exports = { validateNotes, MAX_NOTES_LENGTH };
