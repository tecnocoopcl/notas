import assert from 'node:assert/strict';
import { test } from 'node:test';
import { etagFuerte, hayConflicto } from '../src/notas/sincronia.js';

test('etagFuerte quita el W/ que agrega Cloudflare', () => {
  assert.equal(etagFuerte('W/"1790-text/markdown"'), '"1790-text/markdown"');
  assert.equal(etagFuerte('"1790-text/markdown"'), '"1790-text/markdown"');
  assert.equal(etagFuerte(null), null);
});

test('hayConflicto: el pod sigue en la base, solo cambió el ETag', () => {
  assert.equal(hayConflicto({ enPod: 'a', base: 'a', mio: 'ab' }), false);
});

test('hayConflicto: el pod ya tiene lo mismo que se quiere guardar', () => {
  assert.equal(hayConflicto({ enPod: 'ab', base: 'a', mio: 'ab' }), false);
});

test('hayConflicto: el pod cambió desde otro lado', () => {
  assert.equal(hayConflicto({ enPod: 'ax', base: 'a', mio: 'ab' }), true);
});

test('hayConflicto: sin base conocida, solo coincide si es el mismo texto', () => {
  assert.equal(hayConflicto({ enPod: 'a', base: null, mio: 'ab' }), true);
  assert.equal(hayConflicto({ enPod: 'ab', base: null, mio: 'ab' }), false);
});
