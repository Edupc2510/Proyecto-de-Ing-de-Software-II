// tests/unitaria.validarPuntoRecojo.test.js
// -------------------------------------------------------------
// PRUEBA UNITARIA - US21 Seleccionar punto de recojo
// Metodo: validatePickupPoint(pickupInput, route)
// Archivo: src/trips/pickupValidator.js
// El metodo es una funcion pura: no lee ni escribe archivos, por eso
// se prueba aislado, solo con datos de entrada.
//
// Ruta de prueba: Av. Javier Prado, de San Isidro (-12.0897, -77.0336)
// a la Universidad de Lima (-12.0846, -76.9711), unos 6,8 km.
// -------------------------------------------------------------
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { validatePickupPoint } = require('../src/trips/pickupValidator');

const ruta = { originCoords: [-12.0897, -77.0336], destCoords: [-12.0846, -76.9711] };

describe('Unitaria - validatePickupPoint (US21)', () => {
  it('UT-01 - punto sobre la ruta con direccion -> valido y guarda la direccion', () => {
    const r = validatePickupPoint({ address: 'Av. Javier Prado 1200', coords: [-12.088, -77.0] }, ruta);
    assert.strictEqual(r.valid, true);
    assert.deepStrictEqual(r.pickupPoint, { address: 'Av. Javier Prado 1200', coords: [-12.088, -77.0] });
  });

  it('UT-02 - punto valido sin direccion -> usa el texto por defecto', () => {
    const r = validatePickupPoint({ coords: ['-12.088', '-77.0'] }, ruta);
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.pickupPoint.address, 'Punto seleccionado en el mapa');
    assert.deepStrictEqual(r.pickupPoint.coords, [-12.088, -77.0]);
  });

  it('UT-03 - sin punto de recojo (null) -> error 400', () => {
    const r = validatePickupPoint(null, ruta);
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.status, 400);
    assert.match(r.error, /Debes seleccionar un punto de recojo/);
  });

  it('UT-04 - coordenadas invalidas (latitud 95) -> error 400', () => {
    const r = validatePickupPoint({ coords: [95, -77.0] }, ruta);
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.status, 400);
    assert.match(r.error, /coordenadas/);
  });

  it('UT-05 - punto a unos 6 km de la ruta (escenario 02) -> error 422 fuera de ruta', () => {
    const r = validatePickupPoint({ address: 'Chorrillos', coords: [-12.15, -77.0] }, ruta);
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.status, 422);
    assert.match(r.error, /fuera de la ruta/);
  });

  it('UT-06 - direccion de 250 caracteres -> se recorta a 200', () => {
    const r = validatePickupPoint({ address: 'x'.repeat(250), coords: [-12.088, -77.0] }, ruta);
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.pickupPoint.address.length, 200);
  });
});
