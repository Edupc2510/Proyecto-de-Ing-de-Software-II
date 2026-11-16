// reservations/reservationCollection.js
// ─────────────────────────────────────────────────────────────
// PATRÓN ITERATOR (Comportamiento)
// ─────────────────────────────────────────────────────────────
// Problema: el servicio necesita recorrer las reservas del pasajero, pero
// estas vienen del modelo de la US14 (bookings.json, vía adapter), deben
// recorrerse filtradas (próximas, historial,
// canceladas) y en un orden distinto según la vista. Si el cliente hiciera
// ese recorrido a mano, quedaría acoplado a la estructura interna.
//
// Solución (como el "FiltroIterator" visto en clase):
//   Aggregate          -> ColeccionReservas.crearIterador(filtro)
//   ConcreteIterator   -> IteradorReservas (hasNext() / next())
// El cliente solo pregunta hasNext() y pide next(); no sabe cómo están
// guardadas ni cómo se filtran/ordenan las reservas.
//
// Se combina con Strategy: el iterador recibe la estrategia de filtro.
// ─────────────────────────────────────────────────────────────

class IteradorReservas {
  /**
   * @param {Array} reservas - estructura interna (no se expone al cliente)
   * @param {import('./reservationFilters').FiltroReserva} filtro
   * @param {number} ahora
   */
  constructor(reservas, filtro, ahora) {
    this.filtro = filtro;
    this.ahora = ahora;
    // El iterador conoce el orden del recorrido definido por la estrategia
    this.ordenadas = [...reservas].sort((a, b) => filtro.comparar(a, b));
    this.posicion = 0;
    this.#avanzarHastaCoincidencia();
  }

  hasNext() {
    return this.posicion < this.ordenadas.length;
  }

  next() {
    if (!this.hasNext()) throw new Error('No hay más reservas por recorrer.');
    const actual = this.ordenadas[this.posicion];
    this.posicion += 1;
    this.#avanzarHastaCoincidencia();
    return actual;
  }

  /** Salta las reservas que no cumplen el filtro (recorrido filtrado) */
  #avanzarHastaCoincidencia() {
    while (this.posicion < this.ordenadas.length && !this.filtro.incluye(this.ordenadas[this.posicion], this.ahora)) {
      this.posicion += 1;
    }
  }
}

class ColeccionReservas {
  constructor(reservas = [], ahora = Date.now()) {
    this.reservas = reservas;
    this.ahora = ahora;
  }

  crearIterador(filtro) {
    return new IteradorReservas(this.reservas, filtro, this.ahora);
  }

  /** Cuenta cuántos elementos recorrería un iterador con ese filtro */
  contar(filtro) {
    let total = 0;
    const it = this.crearIterador(filtro);
    while (it.hasNext()) { it.next(); total += 1; }
    return total;
  }
}

module.exports = { ColeccionReservas, IteradorReservas };
