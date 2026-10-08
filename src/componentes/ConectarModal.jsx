import { useState } from 'react';
import { Modal } from './Modal';
import { conectar, resolverProveedor, PROVEEDOR_POR_DEFECTO } from '../pod/solid';

export function ConectarModal({ onClose }) {
  const [entrada, setEntrada] = useState(PROVEEDOR_POR_DEFECTO);
  const [estado, setEstado] = useState({ enviando: false, error: null });

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado({ enviando: true, error: null });
    try {
      await conectar(await resolverProveedor(entrada));
      // login() redirige al proveedor; si vuelve aquí, algo falló.
    } catch (err) {
      setEstado({ enviando: false, error: err.message || 'No se pudo conectar.' });
    }
  }

  return (
    <Modal
      wrapperClassName="modal"
      backdropClassName="modal-fondo"
      contentClassName="modal-contenido"
      titleId="conectar-titulo"
      onClose={onClose}
    >
      <h2 id="conectar-titulo">Conectar con WebID</h2>
      <p>
        Tus notas se guardan en <strong>tu propio Solid Pod</strong>, en la carpeta <code>Documentos/</code>, no
        en este sitio.
      </p>
      <form className="formulario" onSubmit={handleSubmit}>
        <label htmlFor="conectar-entrada">Tu WebID o proveedor de identidad</label>
        <input
          id="conectar-entrada"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck="false"
          required
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
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
            {estado.enviando ? 'Conectando…' : 'Conectar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
