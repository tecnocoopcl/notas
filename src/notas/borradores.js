// Borradores locales: lo que se escribe se guarda al instante en este equipo
// (localStorage) y se sincroniza con el pod después, sin apuro. Si se cierra
// la pestaña o se corta la red antes de sincronizar, el borrador sigue aquí y
// se recupera al volver a abrir la nota.
//
// Cada borrador recuerda la versión del pod sobre la que se escribió: su ETag
// y su texto (`original`). Si al volver el pod tiene otro texto, alguien la
// cambió desde otro lado y hay conflicto. Se compara el texto y no solo el
// ETag: el ETag cambia también sin que cambie la nota (ver sincronia.js).
//
// localStorage puede no existir o estar lleno (modo privado, cuota): en ese
// caso la app sigue funcionando, solo que sin red de seguridad local.

const PREFIJO = 'notas:borrador:';

const clave = (base, ruta) => `${PREFIJO}${base}${ruta}`;

// { texto, etag, original, enviando, fecha } o null. `enviando` es el texto de
// un guardado que estaba en vuelo; `original` falta en los borradores viejos.
export function leerBorrador(base, ruta) {
  try {
    const crudo = localStorage.getItem(clave(base, ruta));
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function guardarBorrador(base, ruta, { texto, etag, original = null, enviando = null }) {
  try {
    localStorage.setItem(clave(base, ruta), JSON.stringify({ texto, etag, original, enviando, fecha: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function borrarBorrador(base, ruta) {
  try {
    localStorage.removeItem(clave(base, ruta));
  } catch {
    /* sin localStorage no hay nada que borrar */
  }
}

// Al borrar una carpeta, sus borradores también.
export function borrarBorradoresBajo(base, carpeta) {
  try {
    const inicio = clave(base, carpeta);
    for (const k of Object.keys(localStorage)) if (k.startsWith(inicio)) localStorage.removeItem(k);
  } catch {
    /* ídem */
  }
}
