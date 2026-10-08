import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ConflictoPod } from '../pod/vault';
import { avisar } from '../pod/solid';
import { borrarBorrador, guardarBorrador, leerBorrador } from '../notas/borradores';
import { Editor } from './Editor';
import { Vista } from './Vista';
import { Grafo } from './Grafo';
import { Link, hrefNota } from '../ruta';
import { nombreDe } from '../notas/wikilinks';

// Una nota abierta: la lee del pod y la muestra en edición o lectura.
//
// Guardado en dos tiempos:
//   1. Cada cambio queda al instante en este equipo (borradores.js).
//   2. Se sincroniza con el pod SINCRONIZAR_TRAS ms después del último
//      cambio, con escritura condicional (If-Match). También al salir de la
//      nota, al ocultar la pestaña y con Ctrl/Cmd+S (guardarYa).
// Si la sincronización falla por red, se reintenta sola; el borrador local
// sigue a salvo mientras tanto. Al abrir una nota con un borrador sin
// sincronizar, se recupera.
//
// El padre la monta con key={ruta}. `control` expone guardarYa(),
// sincronizada() y descartar() para renombrar o borrar sin carreras.

const SINCRONIZAR_TRAS = 10_000;
const GUARDAR_LOCAL_TRAS = 300;
const REINTENTAR_TRAS = 30_000;

const ETIQUETAS = {
  sincronizada: 'Sincronizada',
  local: 'Guardada en este equipo',
  sincronizando: 'Sincronizando…',
  conflicto: 'Conflicto',
  error: 'Sin conexión con el pod · reintentando',
};

export function NotaAbierta({ vault, ruta, indice, modo, onSeguirEnlace, onCrear, control }) {
  const [carga, setCarga] = useState({ estado: 'cargando' });
  // sincronizada | local | sincronizando | conflicto | error
  const [estado, setEstado] = useState('sincronizada');
  const [conflictoDeBorrador, setConflictoDeBorrador] = useState(false);
  const [vistaTexto, setVistaTexto] = useState('');
  const texto = useRef('');
  const etag = useRef(null); // versión del pod sobre la que se está escribiendo
  const sucia = useRef(false); // hay cambios que el pod todavía no tiene
  const tSincronizar = useRef(null);
  const tLocal = useRef(null);
  const enCurso = useRef(Promise.resolve());
  const descartada = useRef(false);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const { actualizar } = indice;
  const base = vault.base;

  const guardarLocalYa = useCallback(() => {
    clearTimeout(tLocal.current);
    tLocal.current = null;
    if (sucia.current && !descartada.current) guardarBorrador(base, ruta, { texto: texto.current, etag: etag.current });
  }, [base, ruta]);

  useEffect(() => {
    let cancelado = false;
    vault
      .leerNota(ruta)
      .then((nota) => {
        if (cancelado) return;
        if (!nota) return setCarga({ estado: 'no-existe' });
        const borrador = leerBorrador(base, ruta);
        etag.current = nota.etag;
        texto.current = nota.texto;
        if (borrador && borrador.texto !== nota.texto) {
          // Quedaron cambios sin sincronizar de la vez anterior.
          texto.current = borrador.texto;
          sucia.current = true;
          if (borrador.etag && borrador.etag !== nota.etag) {
            // …y el pod cambió desde otro lado mientras tanto.
            setConflictoDeBorrador(true);
            setEstado('conflicto');
          } else {
            setEstado('local');
            tSincronizar.current = setTimeout(() => guardarRef.current(), 1000);
          }
        } else if (borrador) {
          borrarBorrador(base, ruta);
        }
        setVistaTexto(texto.current);
        // Puede haber cambiado desde que se indexó.
        actualizar(ruta, texto.current);
        setCarga({ estado: 'lista' });
      })
      .catch((err) => !cancelado && setCarga({ estado: 'error', error: err.message }));
    return () => {
      cancelado = true;
    };
  }, [vault, base, ruta, actualizar]);

  const guardar = useCallback(
    ({ forzar = false } = {}) => {
      clearTimeout(tSincronizar.current);
      tSincronizar.current = null;
      // Los guardados van en fila: el ETag de uno es la condición del siguiente.
      enCurso.current = enCurso.current.then(async () => {
        if (descartada.current || !sucia.current) return;
        if (estadoRef.current === 'conflicto' && !forzar) return;
        guardarLocalYa();
        const contenido = texto.current;
        const veniaConError = estadoRef.current === 'error';
        setEstado('sincronizando');
        try {
          etag.current = await vault.guardarNota(ruta, contenido, { etag: etag.current, forzar });
          actualizar(ruta, contenido);
          setConflictoDeBorrador(false);
          if (texto.current === contenido) {
            sucia.current = false;
            borrarBorrador(base, ruta);
            setEstado('sincronizada');
          } else {
            // Se siguió escribiendo mientras se sincronizaba.
            guardarBorrador(base, ruta, { texto: texto.current, etag: etag.current });
            setEstado('local');
            if (!tSincronizar.current) tSincronizar.current = setTimeout(() => guardarRef.current(), SINCRONIZAR_TRAS);
          }
        } catch (err) {
          if (err instanceof ConflictoPod) {
            setEstado('conflicto');
          } else {
            setEstado('error');
            if (!veniaConError) avisar(`No se pudo sincronizar «${nombreDe(ruta)}»: ${err.message}. Queda guardada en este equipo.`, 'error');
            tSincronizar.current = setTimeout(() => guardarRef.current(), REINTENTAR_TRAS);
          }
        }
      });
      return enCurso.current;
    },
    [vault, base, ruta, actualizar, guardarLocalYa]
  );
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;

  function onChange(nuevo) {
    texto.current = nuevo;
    setVistaTexto(nuevo);
    sucia.current = true;
    clearTimeout(tLocal.current);
    tLocal.current = setTimeout(guardarLocalYa, GUARDAR_LOCAL_TRAS);
    if (estadoRef.current === 'conflicto') return;
    if (estadoRef.current !== 'sincronizando') setEstado('local');
    clearTimeout(tSincronizar.current);
    tSincronizar.current = setTimeout(() => guardarRef.current(), SINCRONIZAR_TRAS);
  }

  const guardarYa = useCallback(() => guardar(), [guardar]);

  useImperativeHandle(
    control,
    () => ({
      guardarYa,
      sincronizada: () => !sucia.current,
      descartar() {
        descartada.current = true;
        clearTimeout(tSincronizar.current);
        clearTimeout(tLocal.current);
        sucia.current = false;
        borrarBorrador(base, ruta);
      },
    }),
    [guardarYa, base, ruta]
  );

  // Al salir de la nota (otra nota, otra vista) se sincroniza lo pendiente.
  useEffect(
    () => () => {
      guardarLocalYaRef.current();
      guardarRef.current();
    },
    []
  );
  const guardarLocalYaRef = useRef(guardarLocalYa);
  guardarLocalYaRef.current = guardarLocalYa;

  // Al ocultar o cerrar la pestaña: el borrador local se escribe ya (eso no
  // puede fallar a medias) y se intenta sincronizar. No hace falta preguntar
  // "¿salir sin guardar?": lo no sincronizado se recupera al volver.
  useEffect(() => {
    function alOcultar() {
      if (document.visibilityState !== 'hidden') return;
      guardarLocalYaRef.current();
      guardarRef.current();
    }
    function antesDeSalir() {
      guardarLocalYaRef.current();
      guardarRef.current();
    }
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', antesDeSalir);
    return () => {
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', antesDeSalir);
      clearTimeout(tSincronizar.current);
      clearTimeout(tLocal.current);
    };
  }, []);

  async function recargar() {
    const nota = await vault.leerNota(ruta);
    clearTimeout(tSincronizar.current);
    clearTimeout(tLocal.current);
    sucia.current = false;
    borrarBorrador(base, ruta);
    setConflictoDeBorrador(false);
    if (!nota) return setCarga({ estado: 'no-existe' });
    texto.current = nota.texto;
    etag.current = nota.etag;
    setVistaTexto(nota.texto);
    actualizar(ruta, nota.texto);
    setEstado('sincronizada');
    // Vuelve a montar el editor con el texto del pod.
    setCarga({ estado: 'lista', version: Date.now() });
  }

  if (carga.estado === 'cargando') return <p className="centro-aviso">Abriendo…</p>;
  if (carga.estado === 'error') return <p className="centro-aviso error">No se pudo abrir la nota: {carga.error}</p>;
  if (carga.estado === 'no-existe') {
    return (
      <div className="centro-aviso">
        <p>«{nombreDe(ruta)}» no existe.</p>
        <button type="button" className="boton primario" onClick={() => onCrear(ruta)}>
          Crear la nota
        </button>
      </div>
    );
  }

  const entrantes = indice.entrantes(ruta);

  return (
    <div className="nota">
      <div className="nota-cuerpo">
        <div className="nota-barra" hidden={estado === 'conflicto'}>
          <span className={`estado-guardado ${estado}`} role="status" title={estado === 'local' ? 'Se sincroniza con el pod unos segundos después de dejar de escribir (Ctrl/Cmd+S para hacerlo ya).' : undefined}>
            {ETIQUETAS[estado]}
          </span>
        </div>
        {estado === 'conflicto' && (
          <div className="conflicto" role="alert">
            <p>
              {conflictoDeBorrador
                ? 'Había cambios tuyos sin sincronizar en este equipo, pero la nota también cambió en el pod desde otro lado.'
                : 'Esta nota cambió en el pod (otro dispositivo u otra pestaña) desde que la abriste.'}
            </p>
            <div className="acciones">
              <button type="button" className="boton" onClick={recargar}>
                Descartar mis cambios y recargar
              </button>
              <button type="button" className="boton peligro" onClick={() => guardar({ forzar: true })}>
                Sobrescribir con mi versión
              </button>
            </div>
          </div>
        )}
        {modo === 'editar' ? (
          <Editor
            key={carga.version ?? 0}
            texto={texto.current}
            ruta={ruta}
            rutas={indice.rutas}
            onChange={onChange}
            onSeguirEnlace={onSeguirEnlace}
          />
        ) : (
          <Vista texto={vistaTexto} ruta={ruta} resolver={indice.resolver} onSeguirEnlace={onSeguirEnlace} />
        )}
      </div>
      <aside className="nota-panel" aria-label="Enlaces de la nota">
        <section>
          <h2>Enlaces entrantes</h2>
          {entrantes.length ? (
            <ul className="entrantes">
              {entrantes.map((r) => (
                <li key={r}>
                  <Link href={hrefNota(r)}>{nombreDe(r)}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tenue">Ninguna nota enlaza a esta.</p>
          )}
        </section>
        <section className="grafo-local">
          <h2>Grafo local</h2>
          <Grafo
            rutas={indice.rutas}
            aristas={indice.aristas}
            actual={ruta}
            local
            onAbrir={({ ruta: r, fantasma }) => onSeguirEnlace(r ? r : fantasma)}
          />
        </section>
      </aside>
    </div>
  );
}
