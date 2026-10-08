import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extraerEnlaces,
  partirWikilink,
  resolverEnlace,
  rutaParaNueva,
  textoDeEnlace,
} from '../src/notas/wikilinks.js';

const rutas = ['Inicio.md', 'Ideas/Proyecto.md', 'Archivo/Proyecto.md', 'Ideas/Sub/Detalle.md', 'Leer después.md'];

test('partirWikilink separa destino, sección y alias', () => {
  assert.deepEqual(partirWikilink('Nota#Parte|otro nombre'), { destino: 'Nota', seccion: 'Parte', alias: 'otro nombre' });
  assert.deepEqual(partirWikilink(' Nota '), { destino: 'Nota', seccion: null, alias: null });
});

test('extraerEnlaces encuentra wikilinks y enlaces markdown, sin repetir', () => {
  const texto = 'Ver [[Inicio]], [[Proyecto|el proyecto]] y [[Inicio#Arriba]].\n[otra](../Leer%20despu%C3%A9s.md) [web](https://x.cl/a.md)';
  assert.deepEqual(extraerEnlaces(texto, 'Ideas/Nota.md'), ['Inicio', 'Proyecto', 'Leer después.md']);
});

test('extraerEnlaces ignora el código', () => {
  const texto = 'a `[[No]]` b\n```\n[[Tampoco]]\n```\n[[Sí]]';
  assert.deepEqual(extraerEnlaces(texto), ['Sí']);
});

test('resolverEnlace por nombre, sin distinguir mayúsculas', () => {
  assert.equal(resolverEnlace('inicio', 'Ideas/X.md', rutas), 'Inicio.md');
  assert.equal(resolverEnlace('Detalle', 'Inicio.md', rutas), 'Ideas/Sub/Detalle.md');
  assert.equal(resolverEnlace('No existe', 'Inicio.md', rutas), null);
});

test('resolverEnlace prefiere la nota más cercana con el mismo nombre', () => {
  assert.equal(resolverEnlace('Proyecto', 'Ideas/Sub/Detalle.md', rutas), 'Ideas/Proyecto.md');
  assert.equal(resolverEnlace('Proyecto', 'Archivo/Otra.md', rutas), 'Archivo/Proyecto.md');
});

test('resolverEnlace con carpeta: raíz, relativa y sufijo', () => {
  assert.equal(resolverEnlace('Archivo/Proyecto', 'Inicio.md', rutas), 'Archivo/Proyecto.md');
  assert.equal(resolverEnlace('Sub/Detalle', 'Ideas/Proyecto.md', rutas), 'Ideas/Sub/Detalle.md');
  assert.equal(resolverEnlace('Sub/Detalle', 'Inicio.md', rutas), 'Ideas/Sub/Detalle.md');
  assert.equal(resolverEnlace('Leer después.md', 'Inicio.md', rutas), 'Leer después.md');
});

test('rutaParaNueva junto a la nota o desde la raíz', () => {
  assert.equal(rutaParaNueva('Nueva', 'Ideas/Proyecto.md'), 'Ideas/Nueva.md');
  assert.equal(rutaParaNueva('Otra/Nueva', 'Ideas/Proyecto.md'), 'Otra/Nueva.md');
});

test('textoDeEnlace usa la ruta solo si el nombre se repite', () => {
  assert.equal(textoDeEnlace('Inicio.md', rutas), 'Inicio');
  assert.equal(textoDeEnlace('Ideas/Proyecto.md', rutas), 'Ideas/Proyecto');
});
