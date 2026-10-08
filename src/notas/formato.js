import { EditorSelection } from '@codemirror/state';

// Comandos de formato Markdown para el editor (atajos de teclado).

// Envuelve cada selección con `marca` (o la quita si ya está). Sin
// selección, inserta las dos marcas y deja el cursor al medio.
export function alternarMarca(marca) {
  return (view) => {
    const { state } = view;
    const n = marca.length;
    const cambios = state.changeByRange((rango) => {
      const antes = state.sliceDoc(rango.from - n, rango.from);
      const despues = state.sliceDoc(rango.to, rango.to + n);
      if (antes === marca && despues === marca) {
        return {
          changes: [
            { from: rango.from - n, to: rango.from },
            { from: rango.to, to: rango.to + n },
          ],
          range: EditorSelection.range(rango.from - n, rango.to - n),
        };
      }
      const texto = state.sliceDoc(rango.from, rango.to);
      if (texto.length > 2 * n && texto.startsWith(marca) && texto.endsWith(marca)) {
        return {
          changes: { from: rango.from, to: rango.to, insert: texto.slice(n, -n) },
          range: EditorSelection.range(rango.from, rango.to - 2 * n),
        };
      }
      return {
        changes: [
          { from: rango.from, insert: marca },
          { from: rango.to, insert: marca },
        ],
        range: EditorSelection.range(rango.from + n, rango.to + n),
      };
    });
    view.dispatch(state.update(cambios, { scrollIntoView: true, userEvent: 'input' }));
    return true;
  };
}

// [texto](url): con selección, la usa de texto y deja seleccionado "url".
export function insertarEnlace(view) {
  const { state } = view;
  const cambios = state.changeByRange((rango) => {
    const texto = state.sliceDoc(rango.from, rango.to);
    const insert = `[${texto}](url)`;
    const inicioUrl = rango.from + texto.length + 3;
    return {
      changes: { from: rango.from, to: rango.to, insert },
      range: texto ? EditorSelection.range(inicioUrl, inicioUrl + 3) : EditorSelection.cursor(rango.from + 1),
    };
  });
  view.dispatch(state.update(cambios, { scrollIntoView: true, userEvent: 'input' }));
  return true;
}

// [[]] con el cursor adentro (abre el autocompletado al escribir).
export function insertarWikilink(view) {
  const { state } = view;
  const cambios = state.changeByRange((rango) => {
    const texto = state.sliceDoc(rango.from, rango.to);
    return {
      changes: { from: rango.from, to: rango.to, insert: `[[${texto}]]` },
      range: EditorSelection.cursor(rango.from + 2 + texto.length),
    };
  });
  view.dispatch(state.update(cambios, { scrollIntoView: true, userEvent: 'input' }));
  return true;
}

// Alterna una casilla en las líneas seleccionadas:
// "texto" / "- texto" → "- [ ] texto" → "- [x] texto" → "- [ ] texto"
export function alternarCasilla(view) {
  const { state } = view;
  const lineas = new Set();
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to; ) {
      const linea = state.doc.lineAt(pos);
      lineas.add(linea.number);
      pos = linea.to + 1;
    }
  }
  const changes = [...lineas].map((n) => {
    const linea = state.doc.line(n);
    const m = /^(\s*)(?:([-*+]) )?(\[( |x|X)\] )?/.exec(linea.text);
    const [prefijo, sangria, vineta = '-', casilla, marca] = m;
    let nuevo;
    if (!casilla) nuevo = `${sangria}${vineta} [ ] `;
    else nuevo = `${sangria}${vineta} [${marca === ' ' ? 'x' : ' '}] `;
    return { from: linea.from, to: linea.from + prefijo.length, insert: nuevo };
  });
  view.dispatch(state.update({ changes, userEvent: 'input' }));
  return true;
}
