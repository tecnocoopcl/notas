import { useMemo } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { partirWikilink } from '../notas/wikilinks';
import { hrefNota } from '../ruta';

// Lectura: Markdown renderizado. Los [[enlaces]] se convierten en <a> con
// data-enlace; el padre intercepta el clic (abre la nota, o la crea si no
// existe). Todo el HTML pasa por DOMPurify: una nota puede venir de otro.

function crearMarked(resolver, origen) {
  const escapar = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return new Marked({
    gfm: true,
    breaks: false,
    extensions: [
      {
        name: 'wikilink',
        level: 'inline',
        start: (src) => src.indexOf('[['),
        tokenizer(src) {
          const m = /^\[\[([^[\]\n]+?)\]\]/.exec(src);
          if (m) return { type: 'wikilink', raw: m[0], interior: m[1] };
        },
        renderer({ interior }) {
          const { destino, seccion, alias } = partirWikilink(interior);
          const ruta = resolver(destino, origen);
          const texto = alias || (seccion ? `${destino} › ${seccion}` : destino);
          const href = ruta ? hrefNota(ruta) : '#';
          const clase = ruta ? 'wikilink' : 'wikilink no-existe';
          return `<a href="${escapar(href)}" class="${clase}" data-enlace="${escapar(destino)}">${escapar(texto)}</a>`;
        },
      },
    ],
  });
}

export function Vista({ texto, ruta, resolver, onSeguirEnlace }) {
  const html = useMemo(() => {
    const crudo = crearMarked(resolver, ruta).parse(texto);
    return DOMPurify.sanitize(crudo, { ADD_ATTR: ['data-enlace'] });
  }, [texto, ruta, resolver]);

  function onClick(e) {
    const a = e.target.closest('a');
    if (!a) return;
    if (a.dataset.enlace !== undefined) {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      onSeguirEnlace(a.dataset.enlace);
      return;
    }
    // Enlace Markdown a otra nota del vault: [texto](otra.md)
    const href = a.getAttribute('href') ?? '';
    if (/\.md(#.*)?$/i.test(href) && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      e.preventDefault();
      let destino = href.replace(/#.*$/, '');
      try {
        destino = decodeURIComponent(destino);
      } catch {
        /* se usa tal cual */
      }
      onSeguirEnlace(destino, { relativo: true });
      return;
    }
    if (/^https?:/i.test(href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  }

  return (
    <article className="vista">
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- delegación de clics en enlaces, que ya son navegables con teclado */}
      <div className="markdown" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
