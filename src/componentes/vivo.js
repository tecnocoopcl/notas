import { syntaxTree } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { partirWikilink } from '../notas/wikilinks';

// Vista previa en vivo para el modo lectura: la nota se ve renderizada y se
// puede editar ahí mismo. Es el mismo editor que el modo edición, con
// decoraciones encima: la sintaxis Markdown se oculta salvo en las líneas
// donde está el cursor, así lo que se escribe nunca pasa por una conversión y
// la nota queda tal cual.
//
// `obtener()` devuelve { ruta, resolver, onSeguirEnlace } al momento de usarse
// (cambian sin recrear el editor).

const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;

const ocultar = Decoration.replace({});
const linea = (clase) => Decoration.line({ class: clase });

class Wikilink extends WidgetType {
  constructor(interior, existe, obtener) {
    super();
    this.interior = interior;
    this.existe = existe;
    this.obtener = obtener;
  }
  eq(otro) {
    return otro.interior === this.interior && otro.existe === this.existe;
  }
  toDOM() {
    const { destino, seccion, alias } = partirWikilink(this.interior);
    const el = document.createElement('span');
    el.className = this.existe ? 'wikilink' : 'wikilink no-existe';
    el.textContent = alias || (seccion ? `${destino} › ${seccion}` : destino);
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.obtener().onSeguirEnlace(destino);
    });
    return el;
  }
}

class Casilla extends WidgetType {
  constructor(marcada) {
    super();
    this.marcada = marcada;
  }
  eq(otro) {
    return otro.marcada === this.marcada;
  }
  toDOM(view) {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.className = 'cm-vivo-casilla';
    el.checked = this.marcada;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // La posición se busca al hacer clic: la del widget cambia al escribir.
      const pos = view.posAtDOM(el);
      view.dispatch({ changes: { from: pos + 1, to: pos + 2, insert: this.marcada ? ' ' : 'x' }, userEvent: 'input' });
    });
    // El estado lo manda el texto: el clic nativo no debe alternarla otra vez.
    el.addEventListener('click', (e) => e.preventDefault());
    return el;
  }
}

class Vineta extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-vivo-vineta';
    el.textContent = '•';
    return el;
  }
}

class Separador extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-vivo-hr';
    return el;
  }
}

class Imagen extends WidgetType {
  constructor(src, alt) {
    super();
    this.src = src;
    this.alt = alt;
  }
  eq(otro) {
    return otro.src === this.src && otro.alt === this.alt;
  }
  toDOM() {
    const el = document.createElement('img');
    el.className = 'cm-vivo-imagen';
    el.src = this.src;
    el.alt = this.alt;
    return el;
  }
}

const marked = new Marked({ gfm: true });

class Tabla extends WidgetType {
  constructor(fuente) {
    super();
    this.fuente = fuente;
  }
  eq(otro) {
    return otro.fuente === this.fuente;
  }
  toDOM(view) {
    const el = document.createElement('div');
    el.className = 'cm-vivo-tabla';
    // Una nota puede venir de otro: todo HTML pasa por DOMPurify.
    el.innerHTML = DOMPurify.sanitize(marked.parse(this.fuente));
    // Clic en la tabla: el cursor entra y se ve el Markdown para editarla.
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      view.dispatch({ selection: { anchor: view.posAtDOM(el) } });
      view.focus();
    });
    return el;
  }
}

// Números de línea que tocan la selección (ahí se muestra el Markdown).
function lineasActivas(state, conFoco) {
  const activas = new Set();
  if (!conFoco) return activas;
  for (const r of state.selection.ranges) {
    const desde = state.doc.lineAt(r.from).number;
    const hasta = state.doc.lineAt(r.to).number;
    for (let n = desde; n <= hasta; n++) activas.add(n);
  }
  return activas;
}

function seleccionToca(state, from, to) {
  return state.selection.ranges.some((r) => r.to >= from && r.from <= to);
}

function decorar(view, obtener) {
  const { state } = view;
  const activas = lineasActivas(state, view.hasFocus);
  const activa = (pos) => activas.has(state.doc.lineAt(pos).number);
  const decos = [];
  const wikilinks = [];

  for (const { from, to } of view.visibleRanges) {
    // Los [[enlaces]] no son Markdown: se buscan a mano, línea por línea.
    for (let pos = from; pos <= to; ) {
      const l = state.doc.lineAt(pos);
      for (const m of l.text.matchAll(WIKILINK)) {
        const desde = l.from + m.index;
        const hasta = desde + m[0].length;
        wikilinks.push([desde, hasta]);
        if (activas.has(l.number)) continue;
        const { ruta, resolver } = obtener();
        const existe = Boolean(resolver(partirWikilink(m[1]).destino, ruta));
        decos.push(Decoration.replace({ widget: new Wikilink(m[1], existe, obtener) }).range(desde, hasta));
      }
      pos = l.to + 1;
    }
    // Lo que Markdown vea dentro de un [[enlace]] (p. ej. "[nota]" como
    // referencia) no se toca; los nodos que lo contienen enteros, sí.
    const enWikilink = (a, b) => wikilinks.some(([x, y]) => a < y && b > x && !(a <= x && b >= y));

    syntaxTree(state).iterate({
      from,
      to,
      enter(nodo) {
        const { name } = nodo;
        if (enWikilink(nodo.from, nodo.to)) return false;

        const titulo = /^(ATX|Setext)Heading(\d)$/.exec(name);
        if (titulo) {
          decos.push(linea(`cm-vivo-h${titulo[2]}`).range(state.doc.lineAt(nodo.from).from));
          return;
        }
        if (name === 'Blockquote') {
          for (let p = nodo.from; p <= nodo.to; ) {
            const l = state.doc.lineAt(p);
            decos.push(linea('cm-vivo-cita').range(l.from));
            p = l.to + 1;
          }
          return;
        }
        if (name === 'FencedCode' || name === 'CodeBlock') {
          for (let p = nodo.from; p <= nodo.to; ) {
            const l = state.doc.lineAt(p);
            decos.push(linea('cm-vivo-bloque').range(l.from));
            p = l.to + 1;
          }
          return false;
        }
        if (name === 'InlineCode') decos.push(Decoration.mark({ class: 'cm-vivo-codigo' }).range(nodo.from, nodo.to));

        if (activa(nodo.from)) return;

        switch (name) {
          case 'HeaderMark': {
            const sigue = state.sliceDoc(nodo.to, nodo.to + 1) === ' ' ? 1 : 0;
            // El "===" de un título Setext queda: es su propia línea.
            if (state.sliceDoc(nodo.from, nodo.from + 1) === '#') decos.push(ocultar.range(nodo.from, nodo.to + sigue));
            break;
          }
          case 'EmphasisMark':
          case 'StrikethroughMark':
          case 'QuoteMark':
            decos.push(ocultar.range(nodo.from, nodo.to + (name === 'QuoteMark' && state.sliceDoc(nodo.to, nodo.to + 1) === ' ' ? 1 : 0)));
            break;
          case 'CodeMark':
            if (nodo.node.parent?.name === 'InlineCode') decos.push(ocultar.range(nodo.from, nodo.to));
            break;
          case 'HorizontalRule':
            decos.push(Decoration.replace({ widget: new Separador() }).range(nodo.from, nodo.to));
            break;
          case 'ListMark': {
            const item = nodo.node.parent;
            if (item?.parent?.name !== 'BulletList') break;
            const tarea = item.getChild('Task');
            if (tarea) decos.push(ocultar.range(nodo.from, tarea.from));
            else decos.push(Decoration.replace({ widget: new Vineta() }).range(nodo.from, nodo.to));
            break;
          }
          case 'TaskMarker': {
            const marcada = /x/i.test(state.sliceDoc(nodo.from, nodo.to));
            decos.push(Decoration.replace({ widget: new Casilla(marcada) }).range(nodo.from, nodo.to));
            if (marcada) {
              const l = state.doc.lineAt(nodo.to);
              if (l.to > nodo.to) decos.push(Decoration.mark({ class: 'cm-vivo-hecha' }).range(nodo.to, l.to));
            }
            break;
          }
          case 'Link':
          case 'Image': {
            const url = nodo.node.getChild('URL');
            const marcas = nodo.node.getChildren('LinkMark');
            // [texto] sin (url) es una referencia: se deja como está.
            if (!url || marcas.length < 2) return false;
            const href = state.sliceDoc(url.from, url.to);
            if (name === 'Image') {
              if (!/^https?:\/\//i.test(href)) return false;
              const alt = state.sliceDoc(marcas[0].to, marcas[1].from);
              decos.push(Decoration.replace({ widget: new Imagen(href, alt) }).range(nodo.from, nodo.to));
              return false;
            }
            decos.push(ocultar.range(nodo.from, marcas[0].to));
            decos.push(
              Decoration.mark({ class: 'cm-vivo-enlace', attributes: { 'data-href': href } }).range(marcas[0].to, marcas[1].from)
            );
            decos.push(ocultar.range(marcas[1].from, nodo.to));
            return false;
          }
        }
      },
    });
  }
  return Decoration.set(decos, true);
}

// Las tablas se reemplazan enteras por un bloque renderizado, y eso solo puede
// venir de un StateField (los plugins no pueden cubrir saltos de línea).
const tablas = StateField.define({
  create: (state) => decorarTablas(state),
  update(decos, tr) {
    return tr.docChanged || tr.selection ? decorarTablas(tr.state) : decos;
  },
  provide: (campo) => EditorView.decorations.from(campo),
});

function decorarTablas(state) {
  const decos = [];
  syntaxTree(state).iterate({
    enter(nodo) {
      if (nodo.name !== 'Table') return;
      const desde = state.doc.lineAt(nodo.from).from;
      const hasta = state.doc.lineAt(nodo.to).to;
      if (!seleccionToca(state, desde, hasta)) {
        decos.push(Decoration.replace({ widget: new Tabla(state.sliceDoc(desde, hasta)), block: true }).range(desde, hasta));
      }
      return false;
    },
  });
  return Decoration.set(decos, true);
}

// Abre un [texto](url): otra nota del vault o una página aparte.
function seguirHref(href, obtener) {
  if (/\.md(#.*)?$/i.test(href) && !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    let destino = href.replace(/#.*$/, '');
    try {
      destino = decodeURIComponent(destino);
    } catch {
      /* se usa tal cual */
    }
    obtener().onSeguirEnlace(destino, { relativo: true });
    return true;
  }
  if (/^https?:/i.test(href)) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

export function vistaEnVivo(obtener) {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = decorar(view, obtener);
      }
      update(u) {
        if (
          u.docChanged ||
          u.viewportChanged ||
          u.selectionSet ||
          u.focusChanged ||
          syntaxTree(u.state) !== syntaxTree(u.startState)
        ) {
          this.decorations = decorar(u.view, obtener);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(e) {
          if (e.button !== 0) return false;
          const enlace = e.target.closest?.('.cm-vivo-enlace');
          if (!enlace) return false;
          if (!seguirHref(enlace.dataset.href ?? '', obtener)) return false;
          e.preventDefault();
          return true;
        },
      },
    }
  );
  return [plugin, tablas, EditorView.editorAttributes.of({ class: 'cm-vivo' })];
}
