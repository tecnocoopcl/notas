import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { avisar, confirmar, desconectar, resolverRaices } from './pod/solid';
import { crearVault, guardarConfig, leerConfig, YaExiste } from './pod/vault';
import { useIndice } from './notas/indice';
import { carpetaDe, nombreDe, rutaParaNueva } from './notas/wikilinks';
import { hrefNota, navegar, useRuta, Link } from './ruta';
import { Arbol } from './componentes/Arbol';
import { NotaAbierta } from './componentes/NotaAbierta';
import { Grafo } from './componentes/Grafo';
import { ConectarModal } from './componentes/ConectarModal';
import { DialogoNombre } from './componentes/Dialogo';
import { Avisos } from './componentes/Avisos';
import { borrarBorrador, borrarBorradoresBajo } from './notas/borradores';
import { Buscador } from './componentes/Buscador';
import { Atajos, MOD } from './componentes/Atajos';

export default function App({ sesion }) {
  const [conectando, setConectando] = useState(false);
  const [raices, setRaices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sesion.conectada) return;
    resolverRaices(sesion.webId).then(setRaices, (err) => setError(err.message));
  }, [sesion]);

  if (!sesion.conectada) {
    return (
      <main className="portada">
        <h1>Notas</h1>
        {sesion.embebida ? (
          <p>Inicia sesión en espacio para ver tus notas.</p>
        ) : (
          <>
            <p>
              Notas en Markdown, enlazadas entre sí con <code>[[corchetes dobles]]</code>, guardadas en tu propio
              Solid Pod.
            </p>
            <button type="button" className="boton primario" onClick={() => setConectando(true)}>
              Conectar con mi pod
            </button>
          </>
        )}
        {conectando && <ConectarModal onClose={() => setConectando(false)} />}
        <Avisos />
      </main>
    );
  }
  if (error) return <p className="centro-aviso error">No se pudo abrir tu pod: {error}</p>;
  if (!raices) return <p className="centro-aviso">Conectando con tu pod…</p>;
  return <Vault raices={raices} sesion={sesion} />;
}

function Vault({ raices, sesion }) {
  const vault = useMemo(() => crearVault(raices.vault), [raices.vault]);
  const indice = useIndice(vault);
  const ruta = useRuta();
  const actual = ruta.vista === 'nota' ? ruta.ruta : null;

  const [contenidos, setContenidos] = useState(() => new Map());
  const [expandidas, setExpandidas] = useState(() => new Set());
  const [config, setConfig] = useState(null);
  const [modo, setModo] = useState('editar');
  const [dialogo, setDialogo] = useState(null);
  const [panel, setPanel] = useState(null); // 'buscador' | 'atajos'
  // En pantallas angostas el lateral se superpone: parte cerrado y se cierra
  // al abrir una nota.
  const angosta = () => window.matchMedia('(max-width: 700px)').matches;
  const [lateral, setLateral] = useState(() => !angosta());
  useEffect(() => {
    if (angosta()) setLateral(false);
  }, [actual]);
  const control = useRef(null);

  const cargarCarpeta = useCallback(
    (carpeta) =>
      vault.listar(carpeta).then(
        (entradas) => setContenidos((m) => new Map(m).set(carpeta, entradas)),
        (err) => setContenidos((m) => new Map(m).set(carpeta, err))
      ),
    [vault]
  );

  // Configuración: última nota y carpetas desplegadas.
  useEffect(() => {
    leerConfig(raices.app).then((c) => {
      setExpandidas(new Set(c.expandidas ?? []));
      setConfig(c);
    });
  }, [raices.app]);

  useEffect(() => {
    if (!config) return;
    const siguiente = { ...config, ultima: actual ?? config.ultima ?? null, expandidas: [...expandidas] };
    if (JSON.stringify(siguiente) === JSON.stringify(config)) return;
    const t = setTimeout(() => {
      setConfig(siguiente);
      guardarConfig(raices.app, siguiente);
    }, 1500);
    return () => clearTimeout(t);
  }, [config, actual, expandidas, raices.app]);

  // Portada: abre la última nota.
  useEffect(() => {
    if (ruta.vista === 'inicio' && config?.ultima) navegar(hrefNota(config.ultima), { reemplazar: true });
    // Solo al cargar la configuración.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config === null]);

  // Lista la raíz y cada carpeta desplegada que falte.
  useEffect(() => {
    for (const carpeta of ['', ...expandidas]) if (!contenidos.has(carpeta)) cargarCarpeta(carpeta);
  }, [expandidas, contenidos, cargarCarpeta]);

  // La nota abierta queda a la vista en el árbol.
  useEffect(() => {
    if (!actual) return;
    const partes = actual.split('/').slice(0, -1);
    const carpetas = partes.map((_, i) => `${partes.slice(0, i + 1).join('/')}/`);
    if (carpetas.some((c) => !expandidas.has(c))) setExpandidas((s) => new Set([...s, ...carpetas]));
  }, [actual, expandidas]);

  // Última nota abierta: a dónde vuelve al cerrar el grafo.
  const ultimaNota = useRef(null);
  if (actual) ultimaNota.current = actual;
  else if (!ultimaNota.current && config?.ultima) ultimaNota.current = config.ultima;
  const cerrarGrafo = () => navegar(ultimaNota.current ? hrefNota(ultimaNota.current) : '/');

  // Vuelve a listar el árbol (y, con `indice`, a releer todas las notas).
  const contenidosRef = useRef(contenidos);
  contenidosRef.current = contenidos;
  const recargarArbol = useCallback(
    () => Promise.all([...contenidosRef.current.keys()].map(cargarCarpeta)),
    [cargarCarpeta]
  );
  // Lo que se cambió desde otro dispositivo o desde Archivos aparece al
  // volver a la pestaña.
  useEffect(() => {
    function alVolver() {
      if (document.visibilityState === 'visible') recargarArbol();
    }
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [recargarArbol]);

  // Atajos de la app (la lista está en Atajos.jsx). Se atrapan en la fase de
  // captura para ganarle al editor, que tiene sus propios Mod-G y Mod-/.
  const atajo = useRef(null);
  atajo.current = (e) => {
    if (document.querySelector('[aria-modal="true"]')) return; // el diálogo maneja sus teclas
    const mod = e.metaKey || e.ctrlKey;
    const tecla = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    let accion = null;
    if (mod && !e.altKey && !e.shiftKey && tecla === 'o') accion = () => setPanel('buscador');
    else if ((e.altKey && !mod && tecla === 'n') || (mod && !e.altKey && !e.shiftKey && tecla === 'n'))
      accion = () => acciones.nuevaNota(actual ? carpetaDe(actual) : '');
    else if (mod && !e.altKey && tecla === 's') accion = () => control.current?.guardarYa();
    else if (mod && !e.altKey && !e.shiftKey && tecla === 'e') accion = () => setModo((m) => (m === 'editar' ? 'leer' : 'editar'));
    // ⌘G es "buscar siguiente" en Chrome y no llega a la página: Alt+G.
    else if ((e.altKey && !mod && tecla === 'g') || (mod && !e.altKey && !e.shiftKey && tecla === 'g'))
      accion = () => (ruta.vista === 'grafo' ? cerrarGrafo() : navegar('/grafo'));
    else if (mod && (e.code === 'Backslash' || e.key === '\\')) accion = () => setLateral((v) => !v);
    else if (mod && (e.key === '/' || e.code === 'Slash' || e.key === '?' || (e.shiftKey && e.code === 'Digit7'))) accion = () => setPanel('atajos');
    else if (e.key === 'Escape' && !mod && ruta.vista === 'grafo') accion = cerrarGrafo;
    if (!accion) return;
    e.preventDefault();
    e.stopPropagation();
    accion();
  };
  useEffect(() => {
    const onKey = (e) => atajo.current(e);
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const alternar = useCallback((carpeta) => {
    setExpandidas((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(carpeta)) nuevo.delete(carpeta);
      else nuevo.add(carpeta);
      return nuevo;
    });
  }, []);

  async function crearNota(rutaNota) {
    const titulo = nombreDe(rutaNota);
    const contenido = `# ${titulo}\n\n`;
    await vault.crearNota(rutaNota, contenido);
    indice.actualizar(rutaNota, contenido);
    await refrescarHasta(rutaNota);
    navegar(hrefNota(rutaNota));
  }

  // Recarga la carpeta de una ruta y las que la contienen (el servidor crea
  // las intermedias que falten).
  async function refrescarHasta(r) {
    const partes = carpetaDe(r).split('/').filter(Boolean);
    const carpetas = ['', ...partes.map((_, i) => `${partes.slice(0, i + 1).join('/')}/`)];
    await Promise.all(carpetas.filter((c) => c === '' || contenidos.has(c) || expandidas.has(c)).map(cargarCarpeta));
  }

  async function seguirEnlace(destino) {
    const encontrada = indice.resolver(destino, actual ?? '');
    if (encontrada) return navegar(hrefNota(encontrada));
    const nueva = rutaParaNueva(destino, actual ?? '');
    try {
      await crearNota(nueva);
    } catch (err) {
      if (err instanceof YaExiste) navegar(hrefNota(nueva));
      else avisar(`No se pudo crear «${nombreDe(nueva)}»: ${err.message}`, 'error');
    }
  }

  const acciones = {
    alternar,
    nuevaNota: (carpeta = '') =>
      setDialogo({
        titulo: 'Nueva nota',
        etiqueta: carpeta ? `Nombre de la nota en ${carpeta}` : 'Nombre de la nota',
        inicial: 'Sin título',
        onAceptar: (nombre) => crearNota(`${carpeta}${nombre.replace(/\.md$/i, '')}.md`),
      }),
    nuevaCarpeta: (carpeta = '') =>
      setDialogo({
        titulo: 'Nueva carpeta',
        etiqueta: carpeta ? `Nombre de la carpeta en ${carpeta}` : 'Nombre de la carpeta',
        inicial: '',
        onAceptar: async (nombre) => {
          const nueva = `${carpeta}${nombre}/`;
          await vault.crearCarpeta(nueva);
          if (carpeta) setExpandidas((s) => new Set(s).add(carpeta));
          await cargarCarpeta(carpeta);
        },
      }),
    renombrar: (desde) =>
      setDialogo({
        titulo: 'Renombrar nota',
        etiqueta: 'Nuevo nombre',
        inicial: nombreDe(desde),
        confirmar: 'Renombrar',
        onAceptar: async (nombre) => {
          const hacia = `${carpetaDe(desde)}${nombre.replace(/\.md$/i, '')}.md`;
          if (hacia === desde) return;
          if (desde === actual) {
            await control.current?.guardarYa();
            if (control.current && !control.current.sincronizada()) {
              throw new Error('La nota tiene cambios que todavía no se sincronizan con el pod. Inténtalo en un momento.');
            }
          }
          await vault.renombrarNota(desde, hacia);
          indice.renombrar(desde, hacia);
          await cargarCarpeta(carpetaDe(desde));
          if (desde === actual) navegar(hrefNota(hacia), { reemplazar: true });
        },
      }),
    borrar: async (r) => {
      const carpeta = r.endsWith('/');
      const nombre = carpeta ? r.slice(0, -1).split('/').pop() : nombreDe(r);
      const ok = await confirmar(
        carpeta
          ? `¿Borrar la carpeta «${nombre}» y todo lo que contiene? No se puede deshacer.`
          : `¿Borrar la nota «${nombre}»? No se puede deshacer.`,
        { title: carpeta ? 'Borrar carpeta' : 'Borrar nota' }
      );
      if (!ok) return;
      const afectaActual = actual && (actual === r || (carpeta && actual.startsWith(r)));
      if (afectaActual) {
        control.current?.descartar();
        navegar('/', { reemplazar: true });
      }
      try {
        await vault.borrar(r);
        indice.quitar(r);
        if (carpeta) borrarBorradoresBajo(vault.base, r);
        else borrarBorrador(vault.base, r);
      } catch (err) {
        avisar(err.message, 'error');
      }
      if (carpeta) {
        setExpandidas((s) => new Set([...s].filter((c) => !c.startsWith(r))));
        setContenidos((m) => new Map([...m].filter(([c]) => !c.startsWith(r))));
      }
      await cargarCarpeta(carpetaDe(carpeta ? r.slice(0, -1) : r));
      if (config?.ultima === r) setConfig((c) => ({ ...c, ultima: null }));
    },
  };

  const { estado } = indice;

  return (
    <div className={`app${lateral ? '' : ' sin-lateral'}`}>
      <aside className="lateral">
        <div className="lateral-cabecera">
          <Link href="/" className="marca">
            Notas
          </Link>
          <div className="lateral-botones">
            <button type="button" className="icono-boton" title={`Nueva nota (${MOD === '⌘' ? '⌥' : 'Alt'}+N)`} aria-label="Nueva nota" onClick={() => acciones.nuevaNota(actual ? carpetaDe(actual) : '')}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
            <button type="button" className="icono-boton" title="Nueva carpeta" aria-label="Nueva carpeta" onClick={() => acciones.nuevaCarpeta('')}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5h4l1.5 1.5h7.5v7.5h-13z M8 8v4M6 10h4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
            <button
              type="button"
              className="icono-boton"
              title="Recargar desde el pod"
              aria-label="Recargar desde el pod"
              onClick={() => {
                recargarArbol();
                indice.recargar();
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.5V5h-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
        <Arbol contenidos={contenidos} expandidas={expandidas} actual={actual} acciones={acciones} />
        <div className="lateral-pie">
          <button
            type="button"
            className={`boton ancho${ruta.vista === 'grafo' ? ' activo' : ''}`}
            aria-pressed={ruta.vista === 'grafo'}
            title={`${MOD === '⌘' ? '⌥' : 'Alt'}+G`}
            onClick={() => (ruta.vista === 'grafo' ? cerrarGrafo() : navegar('/grafo'))}
          >
            {ruta.vista === 'grafo' ? 'Cerrar grafo' : 'Vista de grafo'}
          </button>
          <p className="tenue pequeno" title={sesion.webId}>
            {estado.error
              ? `Índice: ${estado.error}`
              : estado.cargando
                ? `Indexando ${estado.leidas}/${estado.total}…`
                : `${indice.rutas.length} notas`}
          </p>
          <button type="button" className="enlace pequeno" onClick={() => setPanel('atajos')}>
            Atajos de teclado ({MOD}+/)
          </button>
          {!sesion.embebida && (
            <button type="button" className="enlace pequeno" onClick={() => desconectar().then(() => window.location.assign('/'))}>
              Desconectar
            </button>
          )}
        </div>
      </aside>

      <main className="principal">
        <header className="barra">
          <button type="button" className="icono-boton" aria-label={lateral ? 'Ocultar panel lateral' : 'Mostrar panel lateral'} onClick={() => setLateral((v) => !v)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3.5h12v9H2z M6 3.5v9" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
          </button>
          <h1 className="migas">
            {ruta.vista === 'nota' && (
              <>
                {carpetaDe(actual) && <span className="tenue">{carpetaDe(actual).slice(0, -1).split('/').join(' / ')} / </span>}
                {nombreDe(actual)}
              </>
            )}
            {ruta.vista === 'grafo' && 'Grafo'}
          </h1>
          {ruta.vista === 'grafo' && (
            <button type="button" className="icono-boton" title="Cerrar grafo (Esc)" aria-label="Cerrar grafo" onClick={cerrarGrafo}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          )}
          {ruta.vista === 'nota' && (
            <div className="modo" role="group" aria-label="Modo">
              <button type="button" aria-pressed={modo === 'editar'} onClick={() => setModo('editar')} title="Editar (Ctrl/Cmd+E)">
                Editar
              </button>
              <button type="button" aria-pressed={modo === 'leer'} onClick={() => setModo('leer')} title="Leer (Ctrl/Cmd+E)">
                Leer
              </button>
            </div>
          )}
        </header>

        {ruta.vista === 'nota' && (
          <NotaAbierta
            key={actual}
            vault={vault}
            ruta={actual}
            indice={indice}
            modo={modo}
            control={control}
            onSeguirEnlace={seguirEnlace}
            onCrear={(r) => crearNota(r).catch((err) => avisar(err.message, 'error'))}
          />
        )}
        {ruta.vista === 'grafo' && (
          <Grafo
            rutas={indice.rutas}
            aristas={indice.aristas}
            actual={config?.ultima}
            onAbrir={({ ruta: r, fantasma }) => (r ? navegar(hrefNota(r)) : seguirEnlace(fantasma))}
          />
        )}
        {ruta.vista === 'inicio' && (
          <div className="centro-aviso">
            <p>Elige una nota a la izquierda o crea una nueva.</p>
            <button type="button" className="boton primario" onClick={() => acciones.nuevaNota('')}>
              Nueva nota
            </button>
          </div>
        )}
      </main>

      {dialogo && <DialogoNombre {...dialogo} onClose={() => setDialogo(null)} />}
      {panel === 'buscador' && (
        <Buscador
          rutas={indice.rutas}
          onAbrir={(r) => navegar(hrefNota(r))}
          onCrear={(nombre) => seguirEnlace(nombre)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'atajos' && <Atajos onClose={() => setPanel(null)} />}
      <Avisos />
    </div>
  );
}
