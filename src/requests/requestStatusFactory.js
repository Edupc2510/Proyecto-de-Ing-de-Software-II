// requests/requestStatusFactory.js
// ─────────────────────────────────────────────────────────────
// PATRÓN FACTORY METHOD (Creacional)
// ─────────────────────────────────────────────────────────────
// Problema: cada estado de una solicitud (pendiente, aceptada, rechazada,
// cancelada, expirada) se muestra con un texto, un color, una descripción y
// reglas distintas (¿se puede cancelar?, ¿es un estado final?). Si el
// servicio o el frontend usaran if/switch por todos lados, cada nuevo estado
// obligaría a modificar varias clases.
//
// Solución: definimos el producto abstracto EstadoSolicitud y varios productos
// concretos. La FabricaEstadoSolicitud decide qué objeto concreto crear a
// partir del código guardado en el JSON. El cliente (requestService) solo
// trabaja con la abstracción EstadoSolicitud.
//
//   Producto           -> EstadoSolicitud
//   ProductoConcreto   -> EstadoPendiente, EstadoAceptada, EstadoRechazada, ...
//   Creador            -> FabricaEstadoSolicitud.crearEstado(codigo)
// ─────────────────────────────────────────────────────────────

const { REQUEST_STATUS } = require('./requestModel');

/** Producto abstracto */
class EstadoSolicitud {
  get codigo() { throw new Error('Implementar en el estado concreto'); }
  get etiqueta() { throw new Error('Implementar en el estado concreto'); }
  /** Tono visual: info | success | error | neutral | warning */
  get tono() { return 'neutral'; }
  /** Paso alcanzado en la línea de progreso: 1 enviada, 2 en revisión, 3 respuesta */
  get paso() { return 3; }
  esFinal() { return true; }
  puedeCancelar() { return false; }
  descripcion() { return ''; }

  toJSON() {
    return {
      codigo: this.codigo,
      etiqueta: this.etiqueta,
      tono: this.tono,
      paso: this.paso,
      esFinal: this.esFinal(),
      puedeCancelar: this.puedeCancelar(),
    };
  }
}

class EstadoPendiente extends EstadoSolicitud {
  get codigo() { return REQUEST_STATUS.PENDING; }
  get etiqueta() { return 'Pendiente'; }
  get tono() { return 'warning'; }
  get paso() { return 2; }
  esFinal() { return false; }
  puedeCancelar() { return true; }
  descripcion(s) { return `Tu solicitud fue enviada a ${s.driver.name}. Espera su respuesta.`; }
}

class EstadoAceptada extends EstadoSolicitud {
  get codigo() { return REQUEST_STATUS.ACCEPTED; }
  get etiqueta() { return 'Aceptada'; }
  get tono() { return 'success'; }
  descripcion(s) { return `Tu asiento con ${s.driver.name} está reservado. Revisa el viaje en la pestaña "Reservas".`; }
}

class EstadoRechazada extends EstadoSolicitud {
  get codigo() { return REQUEST_STATUS.REJECTED; }
  get etiqueta() { return 'Rechazada'; }
  get tono() { return 'error'; }
  descripcion(s) { return s.responseNote ? `Motivo: ${s.responseNote}` : 'El conductor no pudo aceptar tu solicitud.'; }
}

class EstadoCancelada extends EstadoSolicitud {
  get codigo() { return REQUEST_STATUS.CANCELLED; }
  get etiqueta() { return 'Cancelada'; }
  get tono() { return 'neutral'; }
  descripcion(s) {
    if (s.cancelledBy === 'pasajero') return 'Cancelaste esta solicitud.';
    return s.responseNote ? `El conductor canceló la ruta. Motivo: ${s.responseNote}` : 'El conductor canceló la ruta.';
  }
}

class EstadoExpirada extends EstadoSolicitud {
  get codigo() { return REQUEST_STATUS.EXPIRED; }
  get etiqueta() { return 'Expirada'; }
  get tono() { return 'neutral'; }
  descripcion() { return 'El viaje salió sin que el conductor respondiera tu solicitud.'; }
}

/** Creador: decide qué EstadoSolicitud concreto instanciar */
class FabricaEstadoSolicitud {
  static #estados = {
    [REQUEST_STATUS.PENDING]: EstadoPendiente,
    [REQUEST_STATUS.ACCEPTED]: EstadoAceptada,
    [REQUEST_STATUS.REJECTED]: EstadoRechazada,
    [REQUEST_STATUS.CANCELLED]: EstadoCancelada,
    [REQUEST_STATUS.EXPIRED]: EstadoExpirada,
  };

  /**
   * Factory method: crea el estado concreto según el código persistido.
   * Un código desconocido se trata como pendiente para no romper la vista.
   * @param {string} codigo
   * @returns {EstadoSolicitud}
   */
  static crearEstado(codigo) {
    const ClaseEstado = FabricaEstadoSolicitud.#estados[codigo] || EstadoPendiente;
    return new ClaseEstado();
  }

  static codigosValidos() {
    return Object.keys(FabricaEstadoSolicitud.#estados);
  }
}

module.exports = { EstadoSolicitud, FabricaEstadoSolicitud };
