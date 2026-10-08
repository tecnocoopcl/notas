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
  window.history[reemplazar ? 'replaceState' : 'pushState'](null, '', url.pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
