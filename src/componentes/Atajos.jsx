import { Modal } from './Modal';

// Lista de atajos (Ctrl/Cmd+/). Es también la referencia de qué hace cada uno:
// los de la app están en App.jsx y los de formato en Editor.jsx.

export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
const ALT = MOD === '⌘' ? '⌥' : 'Alt';

export const ATAJOS = [
  {
    grupo: 'General',
    lista: [
      [[MOD, 'O'], 'Abrir nota (buscar o crear)'],
      [[ALT, 'N'], 'Nueva nota'],
      [[MOD, 'S'], 'Guardar ahora'],
      [[MOD, 'E'], 'Alternar Markdown y vista previa (editable)'],
      [[ALT, 'G'], 'Abrir o cerrar el grafo'],
      [[MOD, '\\'], 'Mostrar u ocultar el panel lateral'],
      [['Esc'], 'Cerrar el grafo o un diálogo'],
      [[MOD, '/'], 'Ver estos atajos'],
    ],
  },
  {
    grupo: 'Editor',
    lista: [
      [[MOD, 'B'], 'Negrita'],
      [[MOD, 'I'], 'Cursiva'],
      [[MOD, 'Mayús', 'X'], 'Tachado'],
      [[MOD, 'K'], 'Enlace Markdown'],
      [[MOD, 'Mayús', 'K'], 'Enlace a otra nota [[ ]]'],
      [[MOD, 'L'], 'Casilla de tarea'],
      [['Tab'], 'Sangrar (Mayús+Tab: quitar sangría)'],
      [[MOD, 'F'], 'Buscar en la nota'],
      [[MOD, 'Z'], 'Deshacer'],
      [[MOD, 'Mayús', 'Z'], 'Rehacer'],
      [[MOD, 'clic'], 'Seguir un [[enlace]]'],
    ],
  },
];

export function Atajos({ onClose }) {
  return (
    <Modal
      wrapperClassName="modal"
      backdropClassName="modal-fondo"
      contentClassName="modal-contenido atajos"
      titleId="atajos-titulo"
      onClose={onClose}
    >
      <div className="atajos-cabecera">
        <h2 id="atajos-titulo">Atajos de teclado</h2>
        <button type="button" className="icono-boton" aria-label="Cerrar" onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      {ATAJOS.map(({ grupo, lista }) => (
        <section key={grupo}>
          <h3>{grupo}</h3>
          <dl>
            {lista.map(([teclas, que]) => (
              <div key={que} className="atajo">
                <dt>
                  {teclas.map((t) => (
                    <kbd key={t}>{t}</kbd>
                  ))}
                </dt>
                <dd>{que}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Modal>
  );
}
