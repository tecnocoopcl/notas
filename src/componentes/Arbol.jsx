import { Link, hrefNota } from '../ruta';

// Árbol de carpetas y notas. Las carpetas se listan al desplegarlas
// (`contenidos` guarda lo ya listado, por ruta de carpeta). Las acciones de
// cada fila aparecen al pasar el mouse o con el foco.

function Iconos({ carpeta, abierta }) {
  if (!carpeta) {
    return (
      <svg className="icono" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 1.5h5.5L13 5v9.5H4z M9.5 1.5V5H13" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg className={`icono flecha${abierta ? ' abierta' : ''}`} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Acciones({ entrada, acciones }) {
  return (
    <span className="fila-acciones">
      {entrada.carpeta && (
        <>
          <button type="button" title="Nueva nota aquí" aria-label={`Nueva nota en ${entrada.nombre}`} onClick={() => acciones.nuevaNota(entrada.ruta)}>
            +
          </button>
          <button type="button" title="Nueva carpeta aquí" aria-label={`Nueva carpeta en ${entrada.nombre}`} onClick={() => acciones.nuevaCarpeta(entrada.ruta)}>
            ⊞
          </button>
        </>
      )}
      {!entrada.carpeta && (
        <button type="button" title="Renombrar" aria-label={`Renombrar ${entrada.nombre}`} onClick={() => acciones.renombrar(entrada.ruta)}>
          ✎
        </button>
      )}
      <button type="button" title="Borrar" aria-label={`Borrar ${entrada.nombre}`} onClick={() => acciones.borrar(entrada.ruta)}>
        ×
      </button>
    </span>
  );
}

function Nivel({ carpeta, nivel, contenidos, expandidas, actual, acciones }) {
  const entradas = contenidos.get(carpeta);
  if (entradas === undefined) return <p className="arbol-aviso" style={{ '--nivel': nivel }}>Cargando…</p>;
  if (entradas instanceof Error) return <p className="arbol-aviso error" style={{ '--nivel': nivel }}>{entradas.message}</p>;
  if (!entradas.length && nivel === 0) return <p className="arbol-aviso">Todavía no hay notas.</p>;

  return (
    <ul role={nivel === 0 ? 'tree' : 'group'} className="arbol-lista">
      {entradas.map((e) => {
        const abierta = e.carpeta && expandidas.has(e.ruta);
        return (
          <li key={e.ruta} role="treeitem" aria-expanded={e.carpeta ? abierta : undefined} aria-selected={e.ruta === actual}>
            <div className={`fila${e.ruta === actual ? ' activa' : ''}`} style={{ '--nivel': nivel }}>
              {e.carpeta ? (
                <button type="button" className="fila-nombre" onClick={() => acciones.alternar(e.ruta)}>
                  <Iconos carpeta abierta={abierta} />
                  <span>{e.nombre}</span>
                </button>
              ) : (
                <Link className="fila-nombre" href={hrefNota(e.ruta)}>
                  <Iconos />
                  <span>{e.nombre.replace(/\.md$/i, '')}</span>
                </Link>
              )}
              <Acciones entrada={e} acciones={acciones} />
            </div>
            {abierta && (
              <Nivel
                carpeta={e.ruta}
                nivel={nivel + 1}
                contenidos={contenidos}
                expandidas={expandidas}
                actual={actual}
                acciones={acciones}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Arbol(props) {
  return (
    <nav className="arbol" aria-label="Notas">
      <Nivel carpeta="" nivel={0} {...props} />
    </nav>
  );
}
