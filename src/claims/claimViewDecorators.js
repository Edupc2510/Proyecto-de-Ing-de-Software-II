// claims/claimViewDecorators.js
// ─────────────────────────────────────────────────────────────
// PATRÓN DECORATOR (Estructural)
// ─────────────────────────────────────────────────────────────
// Problema: el estado de un reclamo se muestra de dos formas:
//   - En la lista: datos básicos + tiempo de respuesta.
//   - En el detalle: lo anterior + línea de tiempo + respuesta de soporte
//     + viaje asociado.
// Con herencia tendríamos VistaConTiempo, VistaConTiempoYLinea,
// VistaConTiempoLineaYRespuesta... (una subclase por combinación).
//
// Solución: una vista base (ComponenteConcreto) que se "envuelve" con
// decoradores que agregan información de forma combinable:
//   Componente          -> VistaReclamo (construir())
//   ComponenteConcreto  -> VistaReclamoBase
//   Decorator           -> DecoradorVistaReclamo
//   DecoratorConcreto   -> ConTiempoDeRespuesta, ConLineaDeTiempo,
//                          ConRespuestaSoporte, ConViajeAsociado
// ─────────────────────────────────────────────────────────────

const { CATALOGO_ESTADOS, PASOS_LINEA_TIEMPO, CATEGORIAS, SLA_HORAS } = require('./claimModel');

/** Componente (interfaz común) */
class VistaReclamo {
  construir() { throw new Error('Implementar'); }
}

/** Componente concreto: datos básicos del reclamo */
class VistaReclamoBase extends VistaReclamo {
  constructor(reclamo) {
    super();
    this.reclamo = reclamo;
  }

  construir() {
    const r = this.reclamo;
    const estado = CATALOGO_ESTADOS[r.status] || CATALOGO_ESTADOS.registrado;
    return {
      id: r.id,
      codigo: r.code,
      asunto: r.subject,
      descripcion: r.description,
      categoria: { clave: r.category, etiqueta: CATEGORIAS[r.category]?.etiqueta || r.category },
      prioridad: r.priority,
      estado: { codigo: r.status, etiqueta: estado.etiqueta, tono: estado.tono, final: estado.final, descripcion: estado.descripcion },
      fechaRegistro: r.createdAt,
      ultimaActualizacion: r.updatedAt,
    };
  }
}

/** Decorator abstracto: contiene otro componente y delega en él */
class DecoradorVistaReclamo extends VistaReclamo {
  constructor(componente, reclamo) {
    super();
    this.componente = componente;
    this.reclamo = reclamo;
  }

  construir() {
    return this.componente.construir();
  }
}

/** Agrega el plazo de respuesta (SLA) según la prioridad */
class ConTiempoDeRespuesta extends DecoradorVistaReclamo {
  constructor(componente, reclamo, ahora = Date.now()) {
    super(componente, reclamo);
    this.ahora = ahora;
  }

  construir() {
    const vista = super.construir();
    const horas = SLA_HORAS[this.reclamo.priority] || SLA_HORAS.media;
    const inicio = new Date(this.reclamo.createdAt).getTime();
    const limite = inicio + horas * 3600 * 1000;
    const final = CATALOGO_ESTADOS[this.reclamo.status]?.final;

    vista.tiempoRespuesta = {
      horasCompromiso: horas,
      fechaLimite: new Date(limite).toISOString(),
      horasRestantes: final ? 0 : Math.max(0, Math.round((limite - this.ahora) / 3600000)),
      vencido: !final && this.ahora > limite,
      avance: final ? 100 : Math.min(100, Math.round(((this.ahora - inicio) / (limite - inicio)) * 100)),
    };
    return vista;
  }
}

/** Agrega la línea de tiempo (pasos + historial de cambios de estado) */
class ConLineaDeTiempo extends DecoradorVistaReclamo {
  construir() {
    const vista = super.construir();
    const pasoActual = CATALOGO_ESTADOS[this.reclamo.status]?.paso || 1;
    vista.lineaDeTiempo = {
      pasos: PASOS_LINEA_TIEMPO.map((etiqueta, i) => ({
        etiqueta: i === 3 && vista.estado.final ? vista.estado.etiqueta : etiqueta,
        completado: i + 1 <= pasoActual,
        actual: i + 1 === pasoActual,
      })),
      eventos: (this.reclamo.history || [])
        .map(h => ({ ...h, etiqueta: CATALOGO_ESTADOS[h.status]?.etiqueta || h.status }))
        .sort((a, b) => new Date(b.at) - new Date(a.at)),
    };
    return vista;
  }
}

/** Agrega el agente asignado y la respuesta de soporte, si existen */
class ConRespuestaSoporte extends DecoradorVistaReclamo {
  construir() {
    const vista = super.construir();
    vista.soporte = {
      agente: this.reclamo.assignedAgent || 'Por asignar',
      respuesta: this.reclamo.response || null,
    };
    return vista;
  }
}

/** Agrega un resumen del viaje relacionado al reclamo */
class ConViajeAsociado extends DecoradorVistaReclamo {
  /** @param {Function} buscarReserva - (reservationId) => reserva | null */
  constructor(componente, reclamo, buscarReserva) {
    super(componente, reclamo);
    this.buscarReserva = buscarReserva;
  }

  construir() {
    const vista = super.construir();
    const reserva = this.reclamo.reservationId ? this.buscarReserva(this.reclamo.reservationId) : null;
    vista.viaje = reserva
      ? { reservaId: reserva.id, origen: reserva.route?.origin, destino: reserva.route?.dest, salida: reserva.route?.departureAt, conductor: reserva.driver?.name }
      : null;
    return vista;
  }
}

module.exports = {
  VistaReclamo,
  VistaReclamoBase,
  DecoradorVistaReclamo,
  ConTiempoDeRespuesta,
  ConLineaDeTiempo,
  ConRespuestaSoporte,
  ConViajeAsociado,
};
