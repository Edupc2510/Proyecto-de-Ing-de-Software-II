// Pruebas unitarias – validaciones de la calificación al conductor (US24, escenario 03)
// Módulo probado: rateDriver en src/ratings/driverRatingController.js
// Solo se prueban las validaciones que ocurren antes de leer datos,
// así la prueba no modifica los archivos de /data.

const test = require('node:test');
const assert = require('node:assert/strict');
const { rateDriver } = require('../src/ratings/driverRatingController');

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

const call = (body) => {
  const res = fakeRes();
  rateDriver({ session: { userId: 'pas-1' }, body }, res);
  return res;
};

test('sin viaje indicado → 400', () => {
  const res = call({ score: 5 });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /viaje/);
});

for (const score of [0, 6, 7, -1, 3.5, 'abc', undefined]) {
  test(`puntaje inválido (${String(score)}) → 400`, () => {
    const res = call({ bookingId: 'b1', score });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /entre 1 y 5/);
  });
}

test('comentario de 301 caracteres → 400', () => {
  const res = call({ bookingId: 'b1', score: 4, comment: 'a'.repeat(301) });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /300/);
});
