// tests/tripCatalog.test.js - US27 y US28 (Strategy + Factory Method + Adapter + DAO)
require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert');

const { FabricaOrdenamiento, MasProximos, MasAsientosLibres } = require('../src/tripCatalog/tripSortStrategies');
const { CatalogoViajesService } = require('../src/tripCatalog/tripCatalogService');
const { RutaFuenteAdapter } = require('../src/tripCatalog/routeSourceAdapter');
const { CalificacionConductorAdapter } = require('../src/tripCatalog/driverRatingAdapter');

const AHORA = Date.parse('2026-11-15T10:00:00');
const enMin = min => AHORA + min * 60000;
const viaje = (id, minutos, seats, extra = {}) => ({ id, driverId: `d${id}`, seats, salidaTimestamp: enMin(minutos), origin: 'A', dest: 'B', ...extra });

/** Fuente falsa: el servicio solo necesita listar() (DIP / duck typing) */
const fuente = viajes => ({ listar: () => viajes });
const sinCalificaciones = { resumenDe: () => ({ average: null, count: 0 }) };
const crearService = (viajes, extra = {}) => new CatalogoViajesService({
  fuente: fuente(viajes), calificaciones: sinCalificaciones, reloj: () => AHORA, ...extra,
});
const ids = resultado => resultado.viajes.map(v => v.id);

test('Factory Method: crea la estrategia según la clave y rechaza claves inválidas', () => {
  assert.ok(FabricaOrdenamiento.crear('masProximos') instanceof MasProximos);
  assert.ok(FabricaOrdenamiento.crear('masAsientos') instanceof MasAsientosLibres);
  assert.strictEqual(FabricaOrdenamiento.crear().clave, 'masProximos'); // por defecto
  assert.throws(() => FabricaOrdenamiento.crear('inventado'), /no es válido/);
  assert.deepStrictEqual(FabricaOrdenamiento.opciones().map(o => o.clave), ['masProximos', 'masTarde', 'masAsientos', 'ultimosCupos']);
});

test('US27 esc.01: "Más próximos" muestra primero la salida más cercana a la hora actual', () => {
  const r = crearService([viaje(1, 90, 2), viaje(2, 15, 2), viaje(3, 45, 2)]).listar({ orden: 'masProximos' });
  assert.deepStrictEqual(ids(r), [2, 3, 1]);
});

test('US27 esc.02: "Más tarde" invierte la lista (salidas del final del día primero)', () => {
  const r = crearService([viaje(1, 90, 2), viaje(2, 15, 2), viaje(3, 45, 2)]).listar({ orden: 'masTarde' });
  assert.deepStrictEqual(ids(r), [1, 3, 2]);
});

test('US27 esc.03: con la misma hora de salida desempata la mejor calificación del conductor', () => {
  const calificaciones = { resumenDe: id => ({ average: { d1: 3.2, d2: 4.9, d3: null }[id] ?? null, count: 1 }) };
  const viajes = [viaje(1, 30, 2), viaje(2, 30, 2), viaje(3, 30, 2)];
  const r = crearService(viajes, { calificaciones }).listar({ orden: 'masProximos' });
  assert.deepStrictEqual(ids(r), [2, 1, 3]); // 4.9, 3.2, sin calificación (cuenta como 0)
});

test('US27 esc.04: ordenar combinado con el filtro de tarifa máxima no pierde la condición del precio', () => {
  const viajes = [viaje(1, 60, 2, { price: 8 }), viaje(2, 20, 2, { price: 12 }), viaje(3, 10, 2, { price: 10 }), viaje(4, 5, 2)];
  const r = crearService(viajes).listar({ orden: 'masProximos', tarifaMax: '10' });
  assert.deepStrictEqual(ids(r), [3, 1]); // 2 (S/12) y 4 (sin tarifa) quedan fuera
  assert.throws(() => crearService(viajes).listar({ tarifaMax: 'abc' }), /tarifa máxima/);
});

test('US28 esc.01: "Más asientos libres" muestra arriba los viajes con 3 o 4 cupos', () => {
  const r = crearService([viaje(1, 10, 1), viaje(2, 20, 4), viaje(3, 30, 3), viaje(4, 40, 2)]).listar({ orden: 'masAsientos' });
  assert.deepStrictEqual(ids(r), [2, 3, 4, 1]);
});

test('US28 esc.02: los viajes llenos van al fondo con la etiqueta "Agotado" (solo en orden por disponibilidad)', () => {
  const viajes = [viaje(1, 10, 0), viaje(2, 20, 2), viaje(3, 5, 0), viaje(4, 30, 3)];
  const r = crearService(viajes).listar({ orden: 'masAsientos' });
  assert.deepStrictEqual(ids(r), [4, 2, 3, 1]); // agotados al final, entre ellos por salida más próxima
  assert.deepStrictEqual(r.viajes.filter(v => v.agotado).map(v => v.etiqueta), ['Agotado', 'Agotado']);
  // En un orden por horario los agotados no se muestran (comportamiento actual de /trips)
  assert.deepStrictEqual(ids(crearService(viajes).listar({ orden: 'masProximos' })), [2, 4]);
});

test('US28 esc.03: "Últimos cupos" prioriza los vehículos con exactamente 1 asiento', () => {
  const r = crearService([viaje(1, 10, 3), viaje(2, 20, 1), viaje(3, 30, 2), viaje(4, 40, 0)]).listar({ orden: 'ultimosCupos' });
  assert.deepStrictEqual(ids(r), [2, 3, 1, 4]);
});

test('US28 esc.05: con los mismos asientos libres desempata la salida más próxima', () => {
  const r = crearService([viaje(1, 50, 2), viaje(2, 10, 2), viaje(3, 30, 2)]).listar({ orden: 'masAsientos' });
  assert.deepStrictEqual(ids(r), [2, 3, 1]);
});

test('US28 esc.04: al reservarse un cupo, la siguiente consulta refleja el contador reducido', () => {
  const datos = [viaje(1, 10, 4), viaje(2, 20, 3)];
  const service = crearService(datos);
  assert.strictEqual(service.listar({ orden: 'masAsientos' }).viajes[0].seats, 4);
  datos[0].seats = 3; // otro pasajero reserva en el primer vehículo
  const despues = service.listar({ orden: 'masAsientos' });
  assert.strictEqual(despues.viajes.find(v => v.id === 1).seats, 3);
});

test('El catálogo ignora viajes vencidos y oculta a conductores con cuenta pausada (US32)', () => {
  const viajes = [viaje(1, -10, 2), viaje(2, 10, 2, { driverId: 'pausado' }), viaje(3, 20, 2)];
  const visibilidad = { estaVisible: driverId => driverId !== 'pausado' };
  const r = crearService(viajes, { visibilidad }).listar({ orden: 'masProximos' });
  assert.deepStrictEqual(ids(r), [3]);
});

test('Adapter: traduce las rutas de trips/routeModel al formato del catálogo sin modificarlo', () => {
  const routeModel = {
    getRoutes: () => [{ id: 1, driverId: 'x', origin: 'A', dest: 'B', time: '08:30', seats: '2', expiresAtTimestamp: 123456 }, { id: 2, time: '23:15', seats: 1, fare: '7.5' }],
    isRouteCancelled: ruta => ruta.status === 'cancelada',
  };
  const [primera, segunda] = new RutaFuenteAdapter(routeModel).listar();
  assert.strictEqual(primera.seats, 2);
  assert.strictEqual(primera.salidaTimestamp, 123456);
  assert.strictEqual(primera.price, null);
  assert.strictEqual(primera.origin, 'A'); // conserva los campos originales
  assert.strictEqual(new Date(segunda.salidaTimestamp).getHours(), 23); // sin timestamp: usa "HH:mm" de hoy
  assert.strictEqual(segunda.price, 7.5);
});

test('Adapter: las rutas canceladas por el conductor (US34) no entran al catálogo', () => {
  const routeModel = {
    getRoutes: () => [{ id: 1, seats: 2, time: '09:00' }, { id: 2, seats: 2, time: '09:30', status: 'cancelada' }],
    isRouteCancelled: ruta => ruta.status === 'cancelada',
  };
  assert.deepStrictEqual(new RutaFuenteAdapter(routeModel).listar().map(v => v.id), [1]);
});

test('Adapter: CalificacionConductorAdapter obtiene la reputación desde el módulo de la US24', () => {
  const llamadas = [];
  const ratingModel = { getDriverRatingSummary: id => { llamadas.push(id); return { average: 4.5, count: 2 }; } };
  assert.deepStrictEqual(new CalificacionConductorAdapter(ratingModel).resumenDe('dX'), { average: 4.5, count: 2 });
  assert.deepStrictEqual(llamadas, ['dX']);
});

test('La vista de cada viaje incluye el nombre y la reputación del conductor (igual que /trips)', () => {
  const usuarios = { buscarPorId: id => (id === 'd1' ? { id: 'd1', firstName: 'Ana', lastName: 'Paredes' } : null) };
  const calificaciones = { resumenDe: () => ({ average: 4.2, count: 5 }) };
  const [vista, sinConductor] = crearService([viaje(1, 10, 2), viaje(2, 20, 2, { driverId: null })], { usuarios, calificaciones })
    .listar({ orden: 'masProximos' }).viajes;
  assert.strictEqual(vista.driverName, 'Ana Paredes');
  assert.deepStrictEqual(vista.driverRating, { average: 4.2, count: 5 });
  assert.strictEqual(sinConductor.driverName, null);
  assert.strictEqual(sinConductor.driverRating, null);
});


test('US26 + US27/28: combina horario, cupos, tarifa y visibilidad antes de ordenar', () => {
  const viajes = [viaje(1, 60, 4, { time: '11:00', price: 5 }), viaje(2, 20, 2, { time: '10:20', price: 5 }),
    viaje(3, 10, 1, { time: '10:10', price: 5 }), viaje(4, 30, 3, { time: '10:30', price: 20 }),
    viaje(5, 40, 4, { time: '10:40', price: 5 })];
  const service = crearService(viajes, { visibilidad: { estaVisible: id => id !== 'd5' } });
  const filtros = { timeFrom: '10:00', timeTo: '11:00', minSeats: '2', tarifaMax: '10' };
  assert.deepStrictEqual(ids(service.listar({ ...filtros, orden: 'masProximos' })), [2, 1]);
  assert.deepStrictEqual(ids(service.listar({ ...filtros, orden: 'masAsientos' })), [1, 2]);
  assert.deepStrictEqual(ids(service.listar({ ...filtros, timeTo: '10:30' })), [2]);
});
