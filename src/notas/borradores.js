// Borradores locales: lo que se escribe se guarda al instante en este equipo
// (localStorage) y se sincroniza con el pod después, sin apuro. Si se cierra
// la pestaña o se corta la red antes de sincronizar, el borrador sigue aquí y
// se recupera al volver a abrir la nota.
//
// Cada borrador recuerda el ETag de la versión del pod sobre la que se
// escribió: si al volver el pod tiene otra, alguien la cambió desde otro lado
// y hay conflicto.
//
// localStorage puede no existir o estar lleno (modo privado, cuota): en ese
// caso la app sigue funcionando, solo que sin red de seguridad local.

const PREFIJO = 'notas:borrador:';

const clave = (base, ruta) => `${PREFIJO}${base}${ruta}`;

// { texto, etag, fecha } o null
export function leerBorrador(base, ruta) {
  try {
    const crudo = localStorage.getItem(clave(base, ruta));
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

export function guardarBorrador(base, ruta, { texto, etag }) {
  try {
    localStorage.setItem(clave(base, ruta), JSON.stringify({ texto, etag, fecha: Date.now() }));
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
