import { useState } from 'react';
import { Modal } from './Modal';

// Pide un nombre (nota o carpeta). Reemplaza a window.prompt, que no
// funciona dentro del iframe de espacio.
export function DialogoNombre({ titulo, etiqueta, inicial = '', confirmar = 'Crear', onAceptar, onClose }) {
  const [valor, setValor] = useState(inicial);
  const [estado, setEstado] = useState({ enviando: false, error: null });

  async function handleSubmit(e) {
    e.preventDefault();
    const nombre = valor.trim();
    if (!nombre) return;
    if (/[/\\]/.test(nombre)) {
      setEstado({ enviando: false, error: 'El nombre no puede llevar «/» ni «\\».' });
      return;
    }
    if (nombre.startsWith('.')) {
      setEstado({ enviando: false, error: 'El nombre no puede empezar con un punto.' });
      return;
    }
    setEstado({ enviando: true, error: null });
    try {
      await onAceptar(nombre);
      onClose();
    } catch (err) {
      setEstado({ enviando: false, error: err.message });
    }
  }

  return (
    <Modal
      wrapperClassName="modal"
      backdropClassName="modal-fondo"
      contentClassName="modal-contenido"
      titleId="dialogo-titulo"
      onClose={onClose}
    >
      <h2 id="dialogo-titulo">{titulo}</h2>
      <form className="formulario" onSubmit={handleSubmit}>
        <label htmlFor="dialogo-nombre">{etiqueta}</label>
        <input
          id="dialogo-nombre"
          type="text"
          autoComplete="off"
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        {estado.error && (
          <p className="error" role="alert">
            {estado.error}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="boton primario" disabled={estado.enviando}>
            {estado.enviando ? 'Guardando…' : confirmar}
          </button>
        </div>
      </form>
    </Modal>
  );
}
