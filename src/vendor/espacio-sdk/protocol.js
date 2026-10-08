/**
 * Protocolo entre el shell de espacio y una mini-app embebida.
 *
 * Compartido por los dos lados. Si esto cambia, cambia el contrato público:
 * las mini-apps se despliegan por su cuenta y pueden llevar una SDK más vieja
 * que el shell que las aloja.
 */

export const SDK_VERSION = '0.1.0'

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
})

/** Respuestas grandes no viajan por el canal; ver files.read (pendiente). */
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

export const TIMEOUT_MS = 30_000
