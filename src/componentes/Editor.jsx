import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { autocompletion } from '@codemirror/autocomplete';
import { carpetaDe, nombreDe, textoDeEnlace } from '../notas/wikilinks';
import {
  alternarCasilla,
  alternarMarca,
  insertarEnlace,
  insertarWikilink,
} from '../notas/formato';

// Editor Markdown (CodeMirror 6). No controlado: el texto inicial se carga al
// montar (el padre lo vuelve a montar con `key` al cambiar de nota) y cada
// cambio se avisa con onChange.
//
// Al escribir "[[" sugiere las notas del vault. Ctrl/Cmd+clic sobre un
// [[enlace]] lo sigue.

const tema = EditorView.theme({
  '&': { height: '100%', fontSize: '16px', backgroundColor: 'transparent', color: 'var(--esp-text)' },
  '.cm-scroller': { fontFamily: 'var(--esp-font)', lineHeight: '1.65', padding: '24px 0' },
  '.cm-content': { maxWidth: '760px', margin: '0 auto', padding: '0 32px', caretColor: 'var(--esp-accent)' },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--esp-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--esp-accent) 30%, transparent) !important',
  },
  '.cm-tooltip': { backgroundColor: 'var(--esp-bg-elevated)', border: '1px solid var(--esp-border)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--esp-accent)',
    color: 'var(--esp-accent-text)',
  },
  '.cm-completionDetail': { opacity: 0.7, fontStyle: 'normal', marginLeft: '8px' },
});

// Busca el [[enlace]] que rodea la posición pos en la línea.
function enlaceEn(view, pos) {
  const linea = view.state.doc.lineAt(pos);
  const col = pos - linea.from;
  for (const m of linea.text.matchAll(/\[\[([^[\]\n]+?)\]\]/g)) {
    if (col >= m.index && col <= m.index + m[0].length) return m[1];
  }
  return null;
}

export function Editor({ texto, ruta, rutas, onChange, onSeguirEnlace }) {
  const contenedor = useRef(null);
  // Los callbacks y la lista de rutas cambian sin recrear el editor.
  const props = useRef({});
  props.current = { ruta, rutas, onChange, onSeguirEnlace };

  useEffect(() => {
    function sugerirNotas(contexto) {
      const antes = contexto.matchBefore(/\[\[[^[\]|#\n]*/);
      if (!antes) return null;
      const { ruta: actual, rutas: todas } = props.current;
      const resto = contexto.state.sliceDoc(contexto.pos, contexto.pos + 2);
      const cierre = resto === ']]' ? '' : ']]';
      return {
        from: antes.from + 2,
        options: todas
          .filter((r) => r !== actual)
          .map((r) => ({
            label: nombreDe(r),
            detail: carpetaDe(r).slice(0, -1) || undefined,
            apply: textoDeEnlace(r, todas) + cierre,
            type: 'text',
          })),
        validFor: /^[^[\]|#\n]*$/,
      };
    }

    const view = new EditorView({
      parent: contenedor.current,
      state: EditorState.create({
        doc: texto,
        extensions: [
          basicSetup,
          EditorView.lineWrapping,
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          autocompletion({ override: [sugerirNotas], icons: false }),
          // Atajos de formato (ver Atajos.jsx). Los de la app (Mod-E, Mod-G…)
          // los atrapa App antes de que lleguen aquí.
          Prec.high(
            keymap.of([
              { key: 'Mod-b', run: alternarMarca('**') },
              { key: 'Mod-i', run: alternarMarca('*') },
              { key: 'Mod-Shift-x', run: alternarMarca('~~') },
              { key: 'Mod-k', run: insertarEnlace },
              { key: 'Mod-Shift-k', run: insertarWikilink },
              { key: 'Mod-l', run: alternarCasilla },
              indentWithTab,
            ])
          ),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) props.current.onChange(u.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            mousedown(e, v) {
              if (!(e.metaKey || e.ctrlKey)) return false;
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
              const enlace = pos != null && enlaceEn(v, pos);
              if (!enlace) return false;
              e.preventDefault();
              props.current.onSeguirEnlace(enlace);
              return true;
            },
          }),
          tema,
        ],
      }),
    });
    view.focus();
    return () => view.destroy();
    // Solo al montar: el texto inicial no se vuelve a aplicar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="editor" ref={contenedor} />;
}
