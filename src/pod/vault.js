import { createContainerAt, getContainedResourceUrlAll, getSolidDataset } from '@inrupt/solid-client';
import { podFetch } from './solid';
import { etagFuerte } from '../notas/sincronia';

// Operaciones sobre el vault: una carpeta del pod (Documentos/) con
// subcarpetas y archivos .md. La app trabaja con **rutas** relativas al vault
// ya decodificadas ("Proyectos/Idea.md", "Proyectos/" para una carpeta); las
// URLs del pod solo aparecen aquí.

export const EXTENSION = '.md';

// Lecturas siempre al servidor. Los contenedores del pod responden con
// Last-Modified pero sin Cache-Control, y con eso el navegador puede reusar un
// listado viejo sin preguntar (caché heurística): el árbol no mostraba lo
// recién creado. cache: 'no-store' cubre el navegador; la cabecera, al
// fetch del shell de espacio, que no reenvía la opción `cache`.
function fetchFresco(input, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-cache');
  return podFetch(input, { ...init, headers, cache: 'no-store' });
}

export class ConflictoPod extends Error {
  constructor() {
    super('La nota cambió en el pod desde la última lectura.');
    this.name = 'ConflictoPod';
  }
}

export class YaExiste extends Error {
  constructor(ruta) {
    super(`Ya existe «${ruta}».`);
    this.name = 'YaExiste';
  }
}

export function crearVault(raiz) {
  const base = raiz.endsWith('/') ? raiz : `${raiz}/`;

  // "Proyectos/Mi idea.md" → https://pod/…/Documentos/Proyectos/Mi%20idea.md
  const url = (ruta) => base + ruta.split('/').map(encodeURIComponent).join('/');
  const ruta = (u) =>
    u.slice(base.length).split('/').map((s) => decodeURIComponent(s)).join('/');

  // Lista una carpeta: subcarpetas y notas, carpetas primero, por nombre.
  // Se ocultan los recursos que empiezan con punto (.acl, .meta…).
  async function listar(rutaCarpeta = '') {
    const dataset = await getSolidDataset(url(rutaCarpeta), { fetch: fetchFresco });
    const entradas = getContainedResourceUrlAll(dataset)
      .map((u) => {
        const r = ruta(u);
        const carpeta = r.endsWith('/');
        const nombre = carpeta ? r.slice(0, -1).split('/').pop() : r.split('/').pop();
        return { ruta: r, nombre, carpeta };
      })
      .filter((e) => !e.nombre.startsWith('.') && (e.carpeta || e.nombre.toLowerCase().endsWith(EXTENSION)));
    return entradas.sort((a, b) =>
      a.carpeta !== b.carpeta ? (a.carpeta ? -1 : 1) : a.nombre.localeCompare(b.nombre, 'es', { numeric: true })
    );
  }

  // Todas las notas del vault, recorriendo las carpetas en paralelo.
  async function listarTodo() {
    const notas = [];
    async function recorrer(rutaCarpeta) {
      const entradas = await listar(rutaCarpeta);
      await Promise.all(entradas.map((e) => (e.carpeta ? recorrer(e.ruta) : notas.push(e.ruta))));
    }
    await recorrer('');
    return notas;
  }

  // Devuelve { texto, etag }, o null si no existe.
  async function leerNota(r) {
    const res = await fetchFresco(url(r), { headers: { Accept: 'text/markdown, text/plain, */*' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${r} respondió ${res.status}`);
    return { texto: await res.text(), etag: etagFuerte(res.headers.get('ETag')) };
  }

  // Escritura condicional: con el ETag de la última lectura (If-Match), o
  // exigiendo que no exista (If-None-Match) si es nueva. Así otro dispositivo
  // no se pisa en silencio. Las carpetas intermedias las crea el servidor.
  // Devuelve el ETag nuevo.
  async function guardarNota(r, texto, { etag = null, nueva = false, forzar = false } = {}) {
    const condicion = forzar ? {} : nueva ? { 'If-None-Match': '*' } : etag ? { 'If-Match': etagFuerte(etag) } : {};
    const res = await podFetch(url(r), {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown', ...condicion },
      body: texto,
    });
    if (res.status === 412) throw nueva ? new YaExiste(r) : new ConflictoPod();
    if (!res.ok) throw new Error(`${r} respondió ${res.status}`);
    const nuevo = res.headers.get('ETag');
    if (nuevo) return etagFuerte(nuevo);
    const head = await fetchFresco(url(r), { method: 'HEAD' });
    return etagFuerte(head.headers.get('ETag'));
  }

  async function crearNota(r, texto) {
    return guardarNota(r, texto, { nueva: true });
  }

  async function crearCarpeta(rutaCarpeta) {
    const u = url(rutaCarpeta.endsWith('/') ? rutaCarpeta : `${rutaCarpeta}/`);
    const head = await fetchFresco(u, { method: 'HEAD' });
    if (head.ok) throw new YaExiste(rutaCarpeta);
    await createContainerAt(u, { fetch: podFetch });
  }

  async function borrarRecurso(r) {
    const res = await podFetch(url(r), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`No se pudo borrar ${r} (${res.status})`);
  }

  // Una carpeta solo se puede borrar vacía: primero su contenido. Solo se
  // borra lo que la app muestra; si queda algo más (otros archivos), el
  // servidor rechaza borrar la carpeta y se avisa.
  async function borrar(r) {
    if (r.endsWith('/')) {
      for (const e of await listarCrudo(r)) await borrar(e);
    }
    await borrarRecurso(r);
  }

  // Todo lo que contiene una carpeta, sin filtrar (para borrarla entera).
  async function listarCrudo(rutaCarpeta) {
    const dataset = await getSolidDataset(url(rutaCarpeta), { fetch: fetchFresco });
    return getContainedResourceUrlAll(dataset).map(ruta);
  }

  // Solid no tiene "mover": se copia y después se borra el original.
  async function renombrarNota(desde, hacia) {
    const actual = await leerNota(desde);
    if (!actual) throw new Error(`«${desde}» ya no existe.`);
    await guardarNota(hacia, actual.texto, { nueva: true });
    await borrarRecurso(desde);
  }

  return { base, url, ruta, listar, listarTodo, leerNota, guardarNota, crearNota, crearCarpeta, borrar, renombrarNota };
}

// Configuración de la app (Aplicaciones/notas/config.json): última nota
// abierta y carpetas desplegadas. Es preferencia, no dato: se escribe sin
// condición y un fallo no interrumpe nada.
export async function leerConfig(raizApp) {
  try {
    const res = await fetchFresco(`${raizApp}config.json`, { headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

export async function guardarConfig(raizApp, config) {
  try {
    await podFetch(`${raizApp}config.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config, null, 2),
    });
  } catch (err) {
    console.warn(`No se pudo guardar la configuración: ${err.message}`);
  }
}
