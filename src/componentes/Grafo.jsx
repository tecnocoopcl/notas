import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph from 'force-graph';
import { nombreDe } from '../notas/wikilinks';

// Vista de grafo: un nodo por nota y una arista por enlace resuelto. Los
// enlaces a notas que no existen se pueden mostrar como nodos fantasma.
// Con `centro`, grafo local: la nota y sus vecinos directos.

const ZOOM_MAXIMO = 2.5;

const css = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

function armarDatos(rutas, aristas, { fantasmas, centro }) {
  const nodos = new Map(rutas.map((r) => [r, { id: r, nombre: nombreDe(r), grado: 0 }]));
  const enlaces = [];
  for (const a of aristas) {
    let destino = a.destino;
    if (!destino) {
      if (!fantasmas) continue;
      destino = `?${a.fantasma.toLowerCase()}`;
      if (!nodos.has(destino)) nodos.set(destino, { id: destino, nombre: a.fantasma, grado: 0, fantasma: true });
    }
    if (!nodos.has(a.origen)) continue;
    enlaces.push({ source: a.origen, target: destino });
    nodos.get(a.origen).grado++;
    nodos.get(destino).grado++;
  }
  if (centro && nodos.has(centro)) {
    const vecinos = new Set([centro]);
    for (const e of enlaces) {
      if (e.source === centro) vecinos.add(e.target);
      if (e.target === centro) vecinos.add(e.source);
    }
    return {
      nodes: [...nodos.values()].filter((n) => vecinos.has(n.id)),
      links: enlaces.filter((e) => vecinos.has(e.source) && vecinos.has(e.target)),
    };
  }
  return { nodes: [...nodos.values()], links: enlaces };
}

export function Grafo({ rutas, aristas, actual, onAbrir, local = false }) {
  const contenedor = useRef(null);
  const grafo = useRef(null);
  const resaltados = useRef({ nodos: new Set(), enlaces: new Set(), sobre: null });
  const encuadrado = useRef(false);
  const [fantasmas, setFantasmas] = useState(false);
  const onAbrirRef = useRef(onAbrir);
  onAbrirRef.current = onAbrir;

  const datos = useMemo(
    () => armarDatos(rutas, aristas, { fantasmas, centro: local ? actual : null }),
    [rutas, aristas, fantasmas, local, actual]
  );

  // Se crea una vez; los datos se actualizan aparte para no reiniciar la
  // simulación entera en cada cambio.
  useEffect(() => {
    const el = contenedor.current;
    const colores = () => ({
      nodo: css('--esp-text-muted') || '#9a9db0',
      acento: css('--esp-accent') || '#6f7bf7',
      texto: css('--esp-text') || '#e8e9ef',
      arista: css('--esp-border') || '#2a2d3a',
    });
    let c = colores();
    const g = new ForceGraph(el)
      .backgroundColor('rgba(0,0,0,0)')
      .nodeId('id')
      .nodeLabel(() => '')
      .nodeVal((n) => 1 + n.grado)
      .linkColor((l) => (resaltados.current.enlaces.has(l) ? c.acento : c.arista))
      .linkWidth((l) => (resaltados.current.enlaces.has(l) ? 2 : 1))
      .nodeCanvasObject((n, ctx, escala) => {
        const r = 3 + Math.sqrt(n.grado) * 1.6;
        const { nodos, sobre } = resaltados.current;
        const atenuado = sobre && !nodos.has(n.id);
        ctx.globalAlpha = atenuado ? 0.25 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = n.id === grafo.current?.__actual || nodos.has(n.id) ? c.acento : c.nodo;
        if (n.fantasma) {
          ctx.strokeStyle = c.nodo;
          ctx.lineWidth = 1 / escala;
          ctx.stroke();
        } else ctx.fill();
        if (escala > 1.1 || n.id === sobre) {
          const tam = 12 / escala;
          ctx.font = `${tam}px ${css('--esp-font') || 'system-ui'}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = c.texto;
          ctx.fillText(n.nombre, n.x, n.y + r + 2 / escala);
        }
        ctx.globalAlpha = 1;
      })
      .nodePointerAreaPaint((n, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5 + Math.sqrt(n.grado) * 1.6, 0, 2 * Math.PI);
        ctx.fill();
      })
      .onNodeHover((n) => {
        const nodos = new Set();
        const enlaces = new Set();
        if (n) {
          nodos.add(n.id);
          for (const l of g.graphData().links) {
            if (l.source.id === n.id || l.target.id === n.id) {
              enlaces.add(l);
              nodos.add(l.source.id);
              nodos.add(l.target.id);
            }
          }
        }
        resaltados.current = { nodos, enlaces, sobre: n?.id ?? null };
        el.style.cursor = n ? 'pointer' : '';
      })
      .onNodeClick((n) => onAbrirRef.current(n.fantasma ? { fantasma: n.nombre } : { ruta: n.id }))
      .cooldownTicks(200)
      // Encuadra cuando la simulación se asienta por primera vez.
      .onEngineStop(() => {
        if (encuadrado.current) return;
        encuadrado.current = true;
        // Con pocas notas el encuadre acercaría demasiado: se limita.
        g.zoomToFit(0, 80);
        if (g.zoom() > ZOOM_MAXIMO) g.zoom(ZOOM_MAXIMO);
      });
    grafo.current = g;

    const medir = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
    medir.observe(el);
    const tema = window.matchMedia('(prefers-color-scheme: light)');
    const cambiarTema = () => {
      c = colores();
    };
    tema.addEventListener('change', cambiarTema);
    return () => {
      medir.disconnect();
      tema.removeEventListener('change', cambiarTema);
      g._destructor?.();
    };
  }, []);

  useEffect(() => {
    const g = grafo.current;
    g.__actual = actual;
    // Conserva las posiciones de los nodos que ya estaban.
    const previas = new Map(g.graphData().nodes.map((n) => [n.id, n]));
    g.graphData({
      nodes: datos.nodes.map((n) => Object.assign(previas.get(n.id) ?? {}, n)),
      links: datos.links.map((l) => ({ ...l })),
    });
  }, [datos, actual]);

  return (
    <div className="grafo">
      <div className="grafo-lienzo" ref={contenedor} />
      <label className="grafo-opcion">
        <input type="checkbox" checked={fantasmas} onChange={(e) => setFantasmas(e.target.checked)} />
        Mostrar notas que no existen
      </label>
      {!datos.nodes.length && <p className="grafo-vacio">No hay notas para mostrar.</p>}
    </div>
  );
}
