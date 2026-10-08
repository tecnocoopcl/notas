// Enlaces entre notas, al estilo Obsidian. Sin dependencias del navegador
// para poder probarlo con node:test.
//
//   [[Nota]]                 por nombre de archivo, en cualquier carpeta
//   [[Carpeta/Nota]]         por ruta desde la raíz del vault
//   [[Nota#Sección|alias]]   la sección y el alias no cambian el destino
//   [texto](otra%20nota.md)  enlace Markdown relativo a la nota actual

const WIKI = /\[\[([^[\]\n]+?)\]\]/g;
const MARKDOWN = /(?<!!)\[[^\]\n]*\]\(([^)\s]+\.md)(?:#[^)\s]*)?\)/gi;

// Los bloques y fragmentos de código no enlazan: se blanquean antes de buscar.
function sinCodigo(texto) {
  return texto.replace(/^(```|~~~)[^\n]*\n[\s\S]*?(^\1[^\n]*$|(?![\s\S]))/gm, '').replace(/`[^`\n]*`/g, '');
}

// "Nota#Sección|alias" → { destino: "Nota", seccion: "Sección", alias: "alias" }
export function partirWikilink(interior) {
  const [antesAlias, ...resto] = interior.split('|');
  const alias = resto.length ? resto.join('|').trim() : null;
  const [destino, ...seccion] = antesAlias.split('#');
  return { destino: destino.trim(), seccion: seccion.length ? seccion.join('#').trim() : null, alias };
}

// Destinos (sin resolver) de todos los enlaces de una nota, en orden y sin
// repetir. Los wikilinks se devuelven tal cual; los Markdown, como ruta ya
// relativa a la raíz del vault (con .md).
export function extraerEnlaces(texto, rutaOrigen = '') {
  const limpio = sinCodigo(texto);
  const destinos = [];
  for (const m of limpio.matchAll(WIKI)) {
    const { destino } = partirWikilink(m[1]);
    if (destino) destinos.push(destino);
  }
  for (const m of limpio.matchAll(MARKDOWN)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(m[1])) continue; // http:, mailto:…
    let destino;
    try {
      destino = decodeURIComponent(m[1]);
    } catch {
      destino = m[1];
    }
    const absoluta = resolverRelativa(destino, carpetaDe(rutaOrigen));
    if (absoluta) destinos.push(absoluta);
  }
  return [...new Set(destinos)];
}

export function carpetaDe(ruta) {
  const i = ruta.lastIndexOf('/');
  return i === -1 ? '' : ruta.slice(0, i + 1);
}

export function nombreDe(ruta) {
  return ruta.split('/').pop().replace(/\.md$/i, '');
}

const clave = (ruta) => ruta.replace(/\.md$/i, '').toLowerCase();

// "../a/b.md" desde "x/y/" → "x/a/b.md". null si se sale del vault.
function resolverRelativa(destino, carpeta) {
  const partes = destino.startsWith('/') ? [] : carpeta.split('/').filter(Boolean);
  for (const p of destino.split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') {
      if (!partes.length) return null;
      partes.pop();
    } else partes.push(p);
  }
  return partes.join('/');
}

// Cuántos segmentos de carpeta comparten dos rutas.
function cercania(a, b) {
  const x = carpetaDe(a).split('/');
  const y = carpetaDe(b).split('/');
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n] && x[n] !== '') n++;
  return n;
}

// Resuelve un destino contra las rutas existentes. Devuelve la ruta (con .md)
// o null si no hay ninguna nota que corresponda.
export function resolverEnlace(destino, rutaOrigen, rutas) {
  if (!destino) return null;
  const buscado = clave(destino.replace(/^\/+/, ''));

  if (buscado.includes('/')) {
    // Primero relativo a la carpeta de la nota, después desde la raíz.
    const relativa = resolverRelativa(destino, carpetaDe(rutaOrigen));
    for (const candidata of [relativa && clave(relativa), buscado]) {
      const hallada = candidata && rutas.find((r) => clave(r) === candidata);
      if (hallada) return hallada;
    }
    // Obsidian también acepta un sufijo de ruta: [[Sub/Nota]] → "A/Sub/Nota.md".
    const sufijo = rutas.filter((r) => clave(r).endsWith(`/${buscado}`));
    return masCercana(sufijo, rutaOrigen);
  }

  const mismas = rutas.filter((r) => clave(nombreDe(r)) === buscado);
  return masCercana(mismas, rutaOrigen);
}

// Entre varias con el mismo nombre: la de la misma carpeta, si no la que más
// carpetas comparte con el origen, y a igualdad la menos profunda.
function masCercana(candidatas, rutaOrigen) {
  if (candidatas.length <= 1) return candidatas[0] ?? null;
  return [...candidatas].sort(
    (a, b) =>
      cercania(b, rutaOrigen) - cercania(a, rutaOrigen) ||
      a.split('/').length - b.split('/').length ||
      a.localeCompare(b)
  )[0];
}

// Dónde crear la nota de un enlace que todavía no existe: con carpeta,
// desde la raíz del vault; sin carpeta, junto a la nota que enlaza.
export function rutaParaNueva(destino, rutaOrigen) {
  const limpio = destino.replace(/^\/+/, '').replace(/\.md$/i, '');
  const ruta = limpio.includes('/') ? limpio : carpetaDe(rutaOrigen) + limpio;
  return `${ruta}.md`;
}

// Cómo escribir un enlace a `ruta` desde el autocompletado: por nombre si es
// único en el vault, si no con la ruta completa.
export function textoDeEnlace(ruta, rutas) {
  const nombre = nombreDe(ruta);
  const repetido = rutas.filter((r) => nombreDe(r).toLowerCase() === nombre.toLowerCase()).length > 1;
  return repetido ? ruta.replace(/\.md$/i, '') : nombre;
}
