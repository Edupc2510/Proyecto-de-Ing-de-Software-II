// drivers/contactChannels.js
// ─────────────────────────────────────────────────────────────
// PATRÓN STRATEGY (Comportamiento) + FACTORY METHOD (Creacional) - US30
// ─────────────────────────────────────────────────────────────
// Problema: el pasajero puede contactar a un conductor frecuente por
// WhatsApp, llamada, correo o mensaje interno de MoveShare. Cada canal tiene
// su propia regla de disponibilidad y su propia forma de "contactar". Un
// switch dentro del servicio crecería con cada canal nuevo (ej. Telegram).
//
// Strategy: cada canal es una estrategia con la misma interfaz
//   estaDisponible(conductor) y contactar({ conductor, pasajero, mensaje }).
// El servicio (Context) delega en la estrategia elegida sin conocerla.
//
// Factory Method: FabricaCanalContacto.crearCanal(clave) decide qué
// estrategia concreta instanciar, así el servicio no hace "new" de cada canal.
// ─────────────────────────────────────────────────────────────

const MAX_MENSAJE = 300;

function normalizarTelefonoPeru(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(digitos)) return `51${digitos}`;
  if (/^519\d{8}$/.test(digitos)) return digitos;
  return null;
}

function limpiarMensaje(mensaje) {
  return String(mensaje || '').trim().slice(0, MAX_MENSAJE);
}

function mensajePorDefecto(conductor, pasajero) {
  return `Hola ${conductor.name}, soy ${pasajero.name}. Compartimos viajes en MoveShare, ¿tienes cupo para tu próxima ruta?`;
}

/** Strategy (interfaz común) */
class CanalContacto {
  get clave() { throw new Error('Implementar'); }
  get etiqueta() { throw new Error('Implementar'); }
  // eslint-disable-next-line no-unused-vars
  estaDisponible(conductor) { return true; }
  // eslint-disable-next-line no-unused-vars
  contactar({ conductor, pasajero, mensaje }) { throw new Error('Implementar'); }
}

class CanalWhatsApp extends CanalContacto {
  get clave() { return 'whatsapp'; }
  get etiqueta() { return 'WhatsApp'; }
  estaDisponible(conductor) { return Boolean(normalizarTelefonoPeru(conductor.phone)); }
  contactar({ conductor, pasajero, mensaje }) {
    const texto = limpiarMensaje(mensaje) || mensajePorDefecto(conductor, pasajero);
    return {
      tipo: 'enlace',
      url: `https://wa.me/${normalizarTelefonoPeru(conductor.phone)}?text=${encodeURIComponent(texto)}`,
      mensaje: texto,
    };
  }
}

class CanalLlamada extends CanalContacto {
  get clave() { return 'llamada'; }
  get etiqueta() { return 'Llamar'; }
  estaDisponible(conductor) { return Boolean(normalizarTelefonoPeru(conductor.phone)); }
  contactar({ conductor }) {
    return { tipo: 'enlace', url: `tel:+${normalizarTelefonoPeru(conductor.phone)}`, mensaje: null };
  }
}

class CanalCorreo extends CanalContacto {
  get clave() { return 'correo'; }
  get etiqueta() { return 'Correo'; }
  estaDisponible(conductor) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(conductor.email || '')); }
  contactar({ conductor, pasajero, mensaje }) {
    const texto = limpiarMensaje(mensaje) || mensajePorDefecto(conductor, pasajero);
    const asunto = encodeURIComponent('MoveShare - Coordinación de viaje');
    return { tipo: 'enlace', url: `mailto:${conductor.email}?subject=${asunto}&body=${encodeURIComponent(texto)}`, mensaje: texto };
  }
}

class CanalMensajeInterno extends CanalContacto {
  /** @param {{ guardar: Function }} buzon - DAO donde se registran los mensajes */
  constructor(buzon) {
    super();
    this.buzon = buzon;
  }
  get clave() { return 'mensaje'; }
  get etiqueta() { return 'Mensaje MoveShare'; }
  estaDisponible() { return true; }
  contactar({ conductor, pasajero, mensaje }) {
    const texto = limpiarMensaje(mensaje);
    if (!texto) {
      const error = new Error('Escribe un mensaje para el conductor.');
      error.validacion = true;
      throw error;
    }
    const registro = this.buzon.registrarMensaje({ driverId: conductor.id, passengerId: pasajero.id, texto });
    return { tipo: 'mensaje', url: null, mensaje: texto, mensajeId: registro.id };
  }
}

/** Creador (Factory Method): decide qué estrategia concreta crear */
class FabricaCanalContacto {
  constructor(buzon) {
    this.buzon = buzon;
  }

  crearCanal(clave) {
    switch (clave) {
      case 'whatsapp': return new CanalWhatsApp();
      case 'llamada': return new CanalLlamada();
      case 'correo': return new CanalCorreo();
      case 'mensaje': return new CanalMensajeInterno(this.buzon);
      default: return null;
    }
  }

  crearTodos() {
    return ['whatsapp', 'llamada', 'correo', 'mensaje'].map(clave => this.crearCanal(clave));
  }
}

module.exports = {
  CanalContacto,
  CanalWhatsApp,
  CanalLlamada,
  CanalCorreo,
  CanalMensajeInterno,
  FabricaCanalContacto,
  normalizarTelefonoPeru,
  MAX_MENSAJE,
};
