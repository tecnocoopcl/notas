// Reglas para decidir si una nota está realmente en conflicto con el pod.
//
// El ETag sirve para que el pod rechace una escritura sobre una versión
// vieja, pero no basta para avisarle al socio: un 412 o un ETag distinto no
// siempre significan que alguien más cambió la nota. Pasa, por ejemplo, si
// Cloudflare debilita el ETag (W/"…") o si se cerró la pestaña con un
// guardado en vuelo. Por eso la decisión final se toma mirando el TEXTO.

// El pod está detrás de Cloudflare, que al comprimir una respuesta marca su
// ETag como débil: el "1790…-text/markdown" de CSS llega como
// W/"1790…-text/markdown". CSS compara If-Match en forma fuerte y rechaza el
// débil con 412. El ETag de CSS identifica lo guardado (fecha y tipo);
// Cloudflare solo lo debilitó por la codificación de transporte.
export function etagFuerte(etag) {
  return etag ? etag.replace(/^W\//, '') : etag;
}

// ¿Hay conflicto entre lo que hay en el pod y lo que se quiere escribir?
//   enPod: texto actual en el pod
//   base:  texto del pod sobre el que se empezó a escribir (null si no se sabe)
//   mio:   texto que se quiere guardar
// No lo hay si el pod sigue en la base (solo cambió el ETag) o si ya tiene
// exactamente lo mismo que se quiere guardar (un guardado anterior llegó).
export function hayConflicto({ enPod, base, mio }) {
  if (enPod === mio) return false;
  if (base != null && enPod === base) return false;
  return true;
}
