// Pruebas unitarias – patrón Adapter: createJsonStore sobre JsonDataSource (Singleton)
// Módulo probado: src/shared/jsonStore.js
// Usa una carpeta temporal: no toca los archivos reales de /data.
const { dir } = require('./helpers/tempDataDir');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createJsonStore } = require('../src/shared/jsonStore');
const { JsonDataSource } = require('../src/shared/persistence/JsonDataSource');

test('si el archivo no existe, read() devuelve [] y lo crea vacío', () => {
  const store = createJsonStore('adapter_vacio.json');
  assert.deepEqual(store.read(), []);
  assert.equal(fs.readFileSync(path.join(dir, 'adapter_vacio.json'), 'utf8'), '[]');
});

test('write() y read() guardan y recuperan la colección', () => {
  const store = createJsonStore('adapter_datos.json');
  assert.equal(store.write([{ id: 1, nombre: 'Paula' }]), true);
  assert.deepEqual(store.read(), [{ id: 1, nombre: 'Paula' }]);
});

test('el adaptador usa la misma fuente que los DAO del grupo (Singleton)', () => {
  const store = createJsonStore('adapter_compartido.json');
  store.write([{ id: 'x' }]);
  assert.deepEqual(JsonDataSource.getInstancia().leerColeccion('adapter_compartido.json'), [{ id: 'x' }]);
  JsonDataSource.getInstancia().escribirColeccion('adapter_compartido.json', [{ id: 'y' }]);
  assert.deepEqual(store.read(), [{ id: 'y' }]);
});

test('un archivo con JSON roto se lee como colección vacía', () => {
  fs.writeFileSync(path.join(dir, 'adapter_roto.json'), '{no es json', 'utf8');
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(createJsonStore('adapter_roto.json').read(), []);
  } finally {
    console.error = original;
  }
});
