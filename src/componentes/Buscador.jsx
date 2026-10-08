import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { carpetaDe, nombreDe } from '../notas/wikilinks';

// Abrir nota por nombre (Ctrl/Cmd+O). Busca por nombre y carpeta, sin
// distinguir mayúsculas ni tildes. Si no hay ninguna con ese nombre, la última
// opción la crea.

const normal = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const MAXIMO = 50;

export function Buscador({ rutas, onAbrir, onCrear, onClose }) {
  const [consulta, setConsulta] = useState('');
  const [activo, setActivo] = useState(0);

  const opciones = useMemo(() => {
    const q = normal(consulta.trim());
    const halladas = rutas
      .map((ruta) => {
        const nombre = normal(nombreDe(ruta));
        const completa = normal(ruta);
        const puntaje = !q ? 0 : nombre.startsWith(q) ? 0 : nombre.includes(q) ? 1 : completa.includes(q) ? 2 : -1;
        return { ruta, puntaje };
      })
      .filter((o) => o.puntaje >= 0)
      .sort((a, b) => a.puntaje - b.puntaje || a.ruta.localeCompare(b.ruta, 'es'))
      .slice(0, MAXIMO)
      .map((o) => ({ tipo: 'abrir', ruta: o.ruta }));
    const exacta = halladas.some((o) => normal(nombreDe(o.ruta)) === q);
    if (q && !exacta && !/[\\]/.test(consulta)) halladas.push({ tipo: 'crear', nombre: consulta.trim() });
    return halladas;
  }, [rutas, consulta]);

  const indice = Math.min(activo, Math.max(opciones.length - 1, 0));

  function elegir(o) {
    if (!o) return;
    onClose();
    if (o.tipo === 'abrir') onAbrir(o.ruta);
    else onCrear(o.nombre);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((indice + 1) % Math.max(opciones.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((indice - 1 + opciones.length) % Math.max(opciones.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      elegir(opciones[indice]);
    }
  }

  return (
    <Modal
      wrapperClassName="modal modal-arriba"
      backdropClassName="modal-fondo"
      contentClassName="modal-contenido buscador"
      titleId="buscador-titulo"
      onClose={onClose}
    >
      <h2 id="buscador-titulo" className="solo-lectores">
        Abrir nota
      </h2>
      <input
        type="text"
        className="buscador-entrada"
        placeholder="Buscar o crear una nota…"
        aria-label="Nombre de la nota"
        aria-controls="buscador-opciones"
        aria-activedescendant={opciones.length ? `buscador-${indice}` : undefined}
        autoComplete="off"
        value={consulta}
        onChange={(e) => {
          setConsulta(e.target.value);
          setActivo(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id="buscador-opciones" role="listbox" className="buscador-opciones">
        {opciones.map((o, i) => (
          <li
            key={o.tipo === 'abrir' ? o.ruta : '+crear'}
            id={`buscador-${i}`}
            role="option"
            aria-selected={i === indice}
            className={i === indice ? 'activa' : undefined}
            onMouseMove={() => setActivo(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              elegir(o);
            }}
          >
            {o.tipo === 'abrir' ? (
              <>
                <span>{nombreDe(o.ruta)}</span>
                {carpetaDe(o.ruta) && <span className="tenue">{carpetaDe(o.ruta).slice(0, -1)}</span>}
              </>
            ) : (
              <span>
                Crear «{o.nombre}»
              </span>
            )}
          </li>
        ))}
        {!opciones.length && <li className="tenue vacio">Todavía no hay notas.</li>}
      </ul>
      <p className="buscador-ayuda tenue">↑↓ para moverse · Enter para abrir · Esc para cerrar</p>
    </Modal>
  );
}
