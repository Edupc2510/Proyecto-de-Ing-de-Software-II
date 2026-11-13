// tests/profileValidator.test.js
// Pruebas de US19 (editar perfil). Ejecutar con: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfileUpdate, normalizeName } = require('../src/dashboards/profileValidator');

const current = { firstName: 'Fabrizio', lastName: 'Gómez' };

// ───────────── Escenarios del informe ─────────────

test('US19 esc.01: edición exitosa devuelve solo los campos que cambiaron', () => {
  const result = validateProfileUpdate({ firstName: 'Fabricio', lastName: 'Gómez' }, current);
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, { firstName: 'Fabricio' });
});

test('US19 esc.01: se pueden cambiar nombre y apellido a la vez', () => {
  const result = validateProfileUpdate({ firstName: 'Luis', lastName: 'Rojas' }, current);
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, { firstName: 'Luis', lastName: 'Rojas' });
});

test('US19 esc.02: datos inválidos (números) generan error por campo', () => {
  const result = validateProfileUpdate({ firstName: 'Fab123', lastName: 'Gómez' }, current);
  assert.equal(result.ok, false);
  assert.ok(result.errors.firstName);
  assert.equal(result.errors.lastName, undefined);
});

test('US19 esc.02: símbolos no permitidos son inválidos', () => {
  const result = validateProfileUpdate({ firstName: 'Fab<script>', lastName: 'Gómez' }, current);
  assert.equal(result.ok, false);
  assert.ok(result.errors.firstName);
});

test('US19 esc.02: nombre demasiado corto o demasiado largo es inválido', () => {
  assert.equal(validateProfileUpdate({ firstName: 'A', lastName: 'Gómez' }, current).ok, false);
  assert.equal(validateProfileUpdate({ firstName: 'A'.repeat(51), lastName: 'Gómez' }, current).ok, false);
});

test('US19 esc.03: campos vacíos bloquean la actualización', () => {
  const result = validateProfileUpdate({ firstName: '', lastName: 'Gómez' }, current);
  assert.equal(result.ok, false);
  assert.match(result.errors.firstName, /obligatorio/);
  assert.match(result.message, /obligatorios/);
});

test('US19 esc.03: solo espacios cuenta como vacío', () => {
  const result = validateProfileUpdate({ firstName: '   ', lastName: '  ' }, current);
  assert.equal(result.ok, false);
  assert.ok(result.errors.firstName && result.errors.lastName);
});

test('US19 esc.03: campos ausentes o de otro tipo cuentan como vacíos', () => {
  assert.equal(validateProfileUpdate({}, current).ok, false);
  assert.equal(validateProfileUpdate(undefined, current).ok, false);
  assert.equal(validateProfileUpdate({ firstName: 123, lastName: null }, current).ok, false);
});

test('US19 esc.04: sin cambios devuelve changes vacío (no hay nada que guardar)', () => {
  const result = validateProfileUpdate({ firstName: 'Fabrizio', lastName: 'Gómez' }, current);
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, {});
});

test('US19 esc.04: espacios sobrantes no cuentan como un cambio', () => {
  const result = validateProfileUpdate({ firstName: '  Fabrizio ', lastName: 'Gómez  ' }, current);
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, {});
});

// ───────────── Seguridad y formato ─────────────

test('solo se editan nombre y apellido: email, dni y otros campos se ignoran', () => {
  const result = validateProfileUpdate({
    firstName: 'Luis',
    lastName: 'Gómez',
    email: 'otro@correo.com',
    dni: '99999999',
    password: 'hack',
    id: 'otro-id',
  }, current);
  assert.equal(result.ok, true);
  assert.deepEqual(result.changes, { firstName: 'Luis' });
});

test('acepta tildes, ñ, espacios internos, guiones y apóstrofos', () => {
  for (const name of ['María José', 'Peña', 'Pérez-Díaz', "O'Connor", 'De la Cruz']) {
    const result = validateProfileUpdate({ firstName: name, lastName: 'Gómez' }, current);
    assert.equal(result.ok, true, `debería aceptar "${name}"`);
  }
});

test('normaliza espacios repetidos dentro del nombre', () => {
  const result = validateProfileUpdate({ firstName: 'María    José', lastName: 'Gómez' }, current);
  assert.deepEqual(result.changes, { firstName: 'María José' });
});

test('rechaza nombres que empiezan o terminan con guion o apóstrofo', () => {
  assert.equal(validateProfileUpdate({ firstName: '-Luis', lastName: 'Gómez' }, current).ok, false);
  assert.equal(validateProfileUpdate({ firstName: "Luis'", lastName: 'Gómez' }, current).ok, false);
});

test('normalizeName tolera valores que no son texto', () => {
  assert.equal(normalizeName(undefined), '');
  assert.equal(normalizeName(42), '');
  assert.equal(normalizeName('  Ana  '), 'Ana');
});
