// shared/events/tripEvents.js
// ─────────────────────────────────────────────────────────────
// PATRÓN OBSERVER (comportamiento)
// ─────────────────────────────────────────────────────────────
// "Sujeto" que anuncia lo que pasa con los viajes. El controlador de rutas
// solo publica el evento ("se publicó una ruta", "se canceló una ruta",
// "se creó una reserva") y no sabe quién reacciona. Los "observadores"
// (notificaciones, historial de fiabilidad, ...) se suscriben al evento.
//
// - Responsabilidad única (S): el controlador maneja la petición HTTP; cada
//   observador hace una sola tarea (avisar, registrar strikes).
// - Abierto/cerrado (O): una reacción nueva es otro observador suscrito,
//   sin modificar el controlador.
// - Inversión de dependencias (D): el controlador depende de este bus
//   (una abstracción), no de los módulos de notificaciones o fiabilidad.
//
// Se exporta una sola instancia compartida por toda la app.
// ─────────────────────────────────────────────────────────────

const TRIP_EVENTS = {
  ROUTE_PUBLISHED: 'ruta_publicada',   // US31: buscar pasajeros con ruta habitual coincidente
  BOOKING_CREATED: 'reserva_creada',   // US14: avisar al conductor de la nueva solicitud
  ROUTE_CANCELLED: 'ruta_cancelada',   // US34: avisar a pasajeros y revisar cancelación tardía
};

class TripEventBus {
  constructor() {
    this.observers = new Map(); // evento → [{ name, handler }]
  }

  /**
   * Suscribe un observador a un evento.
   * @param {string} event - Uno de TRIP_EVENTS
   * @param {string} name - Nombre del observador (para los logs)
   * @param {Function} handler - Recibe los datos del evento
   */
  subscribe(event, name, handler) {
    if (!Object.values(TRIP_EVENTS).includes(event)) {
      throw new Error(`[TripEvents] Evento desconocido: ${event}`);
    }
    const list = this.observers.get(event) || [];
    list.push({ name, handler });
    this.observers.set(event, list);
  }

  /**
   * Avisa a todos los observadores del evento.
   * Si un observador falla, se registra el error y los demás siguen:
   * un aviso que no se pudo enviar no debe deshacer la acción del usuario.
   */
  publish(event, payload) {
    (this.observers.get(event) || []).forEach(({ name, handler }) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[TripEvents] El observador "${name}" falló en "${event}":`, error);
      }
    });
  }

  /** Cantidad de observadores de un evento (útil para pruebas). */
  countObservers(event) {
    return (this.observers.get(event) || []).length;
  }
}

const tripEvents = new TripEventBus();

module.exports = { tripEvents, TRIP_EVENTS, TripEventBus };
