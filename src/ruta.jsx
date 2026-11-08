import { useEffect, useState } from 'react';

// Router mínimo, sin dependencias, como el de música.
//
//   /                    portada (abre la última nota, si hay)
//   /nota/<ruta>         una nota: /nota/Ideas/Mi%20idea.md
//   /grafo               el grafo de todo el vault
//
// En GitHub Pages cualquier ruta llega aquí gracias a 404.html (copia de
// index.html). Una ruta desconocida muestra la portada.
export function parseRuta(pathname) {
  const [seccion, ...resto] = pathname.split('/').filter(Boolean);
  if (seccion === 'nota' && resto.length) {
    try {
      return { vista: 'nota', ruta: resto.map(decodeURIComponent).join('/') };
    } catch {
      return { vista: 'inicio' };
    }
  }
  if (seccion === 'grafo') return { vista: 'grafo' };
  return { vista: 'inicio' };
}

export const hrefNota = (ruta) => `/nota/${ruta.split('/').map(encodeURIComponent).join('/')}`;

export function navegar(href, { reemplazar = false } = {}) {
  const url = new URL(href, window.location.origin);
  if (url.pathname === window.location.pathname) return;
  if (reemplazar) {
    window.history.replaceState({ i: posicion() }, '', url.pathname);
  } else {
    const i = posicion() + 1;
    maximo = i; // navegar a una nota nueva descarta lo que había "adelante"
    window.history.pushState({ i }, '', url.pathname);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Historial atrás/adelante, como en un navegador. Cada entrada guarda su
// posición en history.state; `maximo` es la última que existe, así se sabe si
// hay "adelante". Tras recargar la página solo se recuerda hasta donde se llegó.
let maximo = window.history.state?.i ?? 0;
const posicion = () => window.history.state?.i ?? 0;

export const atras = () => window.history.back();
export const adelante = () => window.history.forward();

export function useHistorial() {
  const [estado, setEstado] = useState(() => ({ atras: posicion() > 0, adelante: posicion() < maximo }));
  useEffect(() => {
    const actualizar = () => setEstado({ atras: posicion() > 0, adelante: posicion() < maximo });
    window.addEventListener('popstate', actualizar);
    return () => window.removeEventListener('popstate', actualizar);
  }, []);
  return estado;
}

export function useRuta() {
  const [ruta, setRuta] = useState(() => parseRuta(window.location.pathname));
  useEffect(() => {
    const onPop = () => setRuta(parseRuta(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return ruta;
}

// <a> que navega sin recargar. Ctrl/Cmd+clic y clic central siguen abriendo
// una pestaña nueva, como cualquier enlace.
export function Link({ href, onClick, ...props }) {
  function handleClick(e) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navegar(href);
  }
  return <a href={href} onClick={handleClick} {...props} />;
}
