import { useEffect, useState } from 'react';

// Avisos breves fuera de espacio (dentro, los muestra el shell). Escucha el
// evento que dispara avisar() en pod/solid.js.
export function Avisos() {
  const [avisos, setAvisos] = useState([]);

  useEffect(() => {
    let id = 0;
    function onAviso(e) {
      const aviso = { id: ++id, ...e.detail };
      setAvisos((a) => [...a, aviso]);
      setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== aviso.id)), 5000);
    }
    window.addEventListener('notas:aviso', onAviso);
    return () => window.removeEventListener('notas:aviso', onAviso);
  }, []);

  return (
    <div className="avisos" aria-live="polite">
      {avisos.map((a) => (
        <p key={a.id} className={`aviso ${a.tone}`}>
          {a.message}
        </p>
      ))}
    </div>
  );
}
