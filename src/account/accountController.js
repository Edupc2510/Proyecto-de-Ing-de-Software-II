// account/accountController.js
// Capa de PRESENTACIÓN. Solo habla con AccountFacade (Ley de Demeter): no
// conoce DAOs, validadores ni el módulo de usuarios.

const { handle, DomainError } = require('../shared/httpHelpers');
const { ErrorValidacion } = require('./profileValidators');

/**
 * Traduce los errores de validación (422 con detalle por campo) y deja que
 * `handle` se encargue del resto de errores de dominio.
 */
function conValidacion(fn, contexto) {
  return handle((req, res) => {
    try {
      return fn(req, res);
    } catch (error) {
      if (error instanceof ErrorValidacion) {
        return res.status(error.status).json({ success: false, error: error.message, errores: error.errores });
      }
      throw error;
    }
  }, contexto);
}

function crearControlador(cuenta) {
  return {
    obtenerPerfil: handle((req, res) => {
      res.status(200).json({ success: true, perfil: cuenta.obtenerPerfil(req.session.userId) });
    }, 'Account.obtenerPerfil'),

    actualizarPerfil: conValidacion((req, res) => {
      const resultado = cuenta.actualizarPerfil(req.session.userId, req.body || {});
      res.status(200).json({ success: true, ...resultado });
    }, 'Account.actualizarPerfil'),

    obtenerAjustes: handle((req, res) => {
      res.status(200).json({ success: true, ajustes: cuenta.obtenerAjustes(req.session.userId) });
    }, 'Account.obtenerAjustes'),

    actualizarAjustes: conValidacion((req, res) => {
      const resultado = cuenta.actualizarAjustes(req.session.userId, req.body || {});
      res.status(200).json({ success: true, ...resultado });
    }, 'Account.actualizarAjustes'),

    perfilPublico: handle((req, res) => {
      const perfil = cuenta.perfilPublico(req.params.userId);
      if (!perfil) throw new DomainError('Perfil no disponible.', 404);
      res.status(200).json({ success: true, perfil });
    }, 'Account.perfilPublico'),
  };
}

module.exports = { crearControlador };
