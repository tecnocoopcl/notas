import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ wrapperClassName, backdropClassName, contentClassName, titleId, onClose, children }) {
  const contentRef = useRef(null);
  // En una ref: si el padre pasa una función nueva en cada render, el efecto
  // no debe volver a correr (devolvería el foco al primer campo).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const content = contentRef.current;
    const focusable = content ? Array.from(content.querySelectorAll(FOCUSABLE)) : [];
    focusable[0]?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  // En <body>: un ancestro con backdrop-filter o transform (la barra
  // superior) haría que position: fixed se mida contra él y no contra la ventana.
  return createPortal(
    <div className={wrapperClassName}>
      <div className={backdropClassName} onClick={() => onCloseRef.current()} />
      <div className={contentClassName} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={contentRef}>
        {children}
      </div>
    </div>,
    document.body
  );
}
