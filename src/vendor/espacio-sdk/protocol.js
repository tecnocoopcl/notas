/**
 * Protocolo entre el shell de espacio y una mini-app embebida.
 *
 * Compartido por los dos lados. Si esto cambia, cambia el contrato público:
 * las mini-apps se despliegan por su cuenta y pueden llevar una SDK más vieja
 * que el shell que las aloja.
 */

export const SDK_VERSION = '0.4.0'

/** Orígenes desde los que un shell legítimo puede abrir el canal. */
export const SHELL_ORIGINS = Object.freeze([
  'app://espacio',
  'http://localhost:5173', // desarrollo
])

/** Mensaje que la app emite al cargar para decir que está lista. Sin datos. */
export const READY = 'espacio:ready'
/** Mensaje con el que el shell abre el canal. Lleva el MessagePort. */
export const OPEN = 'espacio:open'

/** Tipos de trama que viajan por el MessagePort. */
export const FRAME = Object.freeze({
  HELLO: 'hello',
  REQUEST: 'req',
  RESPONSE: 'res',
  ERROR: 'err',
  EVENT: 'ev',
})

/** Métodos que una app puede invocar. El shell valida cada uno igualmente. */
export const METHOD = Object.freeze({
  FETCH: 'fetch',
  UI_CONFIRM: 'ui.confirm',
  UI_NOTIFY: 'ui.notify',
  /** Avisar al socio o a otro socio (capacidad `notify`; ADR-029). Desde SDK 0.2.0. */
  NOTIFICAR: 'notificar',
  /** Contar algo hecho en la app (capacidad `activity`; ADR-030). Desde SDK 0.3.0. */
  ACTIVIDAD: 'actividad',
})

/** Eventos que el shell manda a la app (`espacio.on`). */
export const EVENT = Object.freeze({
  SESSION_CHANGED: 'session-changed',
  /**
   * El tema del socio (ADR-034): `{ tema: 'claro' | 'oscuro', contraste, variables }`,
   * con `variables` el valor de cada una de THEME_VARIABLES. Llega al conectar
   * y cada vez que cambia. Desde SDK 0.4.0 la SDK lo aplica sola al documento.
   */
  THEME_CHANGED: 'theme-changed',
})

/**
 * Las variables de color de `tema.css` que el shell manda en `theme-changed`.
 * Las demás (radios, estados, elevaciones) no dependen del tema o se derivan
 * de estas, así que basta con la copia de `tema.css` que lleva cada app.
 */
export const THEME_VARIABLES = Object.freeze([
  '--esp-bg',
  '--esp-bg-elevated',
  '--esp-bg-sunken',
  '--esp-border',
  '--esp-border-control',
  '--esp-text',
  '--esp-text-muted',
  '--esp-accent',
  '--esp-accent-text',
  '--esp-danger',
  '--esp-danger-text',
  '--esp-ok',
  '--esp-warn',
])

/** Respuestas grandes no viajan por el canal; ver files.read (pendiente). */
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

export const TIMEOUT_MS = 30_000
