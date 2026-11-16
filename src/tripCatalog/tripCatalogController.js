// tripCatalog/tripCatalogController.js
// Capa de PRESENTACIÓN: traduce HTTP -> servicio -> HTTP. Sin lógica de negocio.

const { CatalogoViajesService } = require('./tripCatalogService');
const { RutaFuenteAdapter } = require('./routeSourceAdapter');
const { CalificacionConductorAdapter } = require('./driverRatingAdapter');
const { UsuarioRepositorioAdapter } = require('../shared/users/userRepositoryAdapter');
const { handle } = require('../shared/httpHelpers');

/**
 * @param {{ visibilidad?: object }} [dependencias] - política de visibilidad (US32)
 */
function crearService({ visibilidad } = {}) {
  return new CatalogoViajesService({
    fuente: new RutaFuenteAdapter(),
    calificaciones: new CalificacionConductorAdapter(),
    usuarios: new UsuarioRepositorioAdapter(),
    visibilidad,
  });
}

/** GET /trip-catalog?orden=masProximos&tarifaMax=10 */
function crearControlador(service) {
  return {
    listar: handle((req, res) => {
      const resultado = service.listar({ orden: req.query.orden, tarifaMax: req.query.tarifaMax, timeFrom: req.query.timeFrom, timeTo: req.query.timeTo, minSeats: req.query.minSeats });
      res.status(200).json({ success: true, ...resultado });
    }, 'TripCatalog.listar'),
  };
}

module.exports = { crearService, crearControlador };
