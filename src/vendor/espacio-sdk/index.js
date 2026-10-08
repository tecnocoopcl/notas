import {
  FRAME,
  METHOD,
  OPEN,
  READY,
  SDK_VERSION,
  SHELL_ORIGINS,
  TIMEOUT_MS,
} from './protocol.js'

export { SDK_VERSION }

export class EspacioError extends Error {
  constructor(name, message, status) {
    super(message)
    this.name = name
    if (status !== undefined) this.status = status
  }
}

/** ¿Esta app se está ejecutando dentro de espacio? */
export function isEmbedded() {
  return typeof window !== 'undefined' && window.parent !== window
}

/**
 * Establece el canal con el shell.
 *
 * Devuelve `null` si la app no está embebida, para que el mismo build siga
 * funcionando desplegado por su cuenta. Nunca lanza por no estar en espacio.
 *
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<import('./index.d.ts').Espacio | null>}
 */
export function connect({ timeout = 5000 } = {}) {
  if (!isEmbedded()) return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new EspacioError('EspacioTimeout', 'El shell no respondió al saludo'))
    }, timeout)

    function onMessage(event) {
      // El shell es quien abre el canal, y solo se acepta desde su origen.
      if (!SHELL_ORIGINS.includes(event.origin)) return
      if (event.data?.type !== OPEN) return
      const port = event.ports?.[0]
      if (!port) return

      window.removeEventListener('message', onMessage)
      clearTimeout(timer)

      port.start()
      // El nonce se devuelve tal cual: prueba al shell que el saludo viene de
      // quien recibió el puerto, no de otro frame que observase el mensaje.
      port.postMessage({ t: FRAME.HELLO, nonce: event.data.nonce, sdk: SDK_VERSION })

      resolve(buildApi(port, event.data))
    }

    window.addEventListener('message', onMessage)
    // Solo una señal, sin datos: el shell puede estar escuchando ya.
    window.parent.postMessage({ type: READY, sdk: SDK_VERSION }, '*')
  })
}

/**
 * Construye el objeto `Espacio` sobre un `MessagePort` ya abierto.
 *
 * Exportada (además de usarse internamente desde `connect()`) para poder
 * probar `espacioFetch` con un `MessageChannel` real de Node, sin necesitar
 * `window`/`document`: no es parte de la API pública pensada para consumidores.
 */
export function buildApi(port, hello) {
  let nextId = 1
  const pending = new Map()
  const listeners = new Map()

  port.addEventListener('message', (event) => {
    const frame = event.data
    if (frame?.t === FRAME.EVENT) {
      for (const fn of listeners.get(frame.n) ?? []) fn(frame.v)
      return
    }
    const entry = pending.get(frame?.id)
    if (!entry) return
    pending.delete(frame.id)
    clearTimeout(entry.timer)
    if (frame.t === FRAME.RESPONSE) entry.resolve(frame.v)
    else entry.reject(new EspacioError(frame.e?.name ?? 'EspacioError', frame.e?.message ?? 'Error', frame.e?.status))
  })

  function call(method, args, transfer = []) {
    return new Promise((resolve, reject) => {
      const id = nextId++
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new EspacioError('EspacioTimeout', `Sin respuesta a ${method}`))
      }, TIMEOUT_MS)
      pending.set(id, { resolve, reject, timer })
      port.postMessage({ id, t: FRAME.REQUEST, m: method, a: args }, transfer)
    })
  }

  /**
   * `fetch` autenticado, compatible con la firma WHATWG.
   *
   * Existe para que `@inrupt/solid-client` funcione sin enterarse de que hay un
   * iframe y un proceso main de por medio:
   *
   *     saveSolidDatasetAt(url, ds, { fetch: espacio.fetch })
   *
   * Un `Response` no es clonable, así que se serializa y se reconstruye aquí.
   */
  async function espacioFetch(input, init = {}) {
    const request = input instanceof Request ? input : new Request(input, init)
    const body = request.method === 'GET' || request.method === 'HEAD'
      ? null
      : await request.arrayBuffer()

    const result = await call(
      METHOD.FETCH,
      {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body,
      },
      body && body.byteLength > 0 ? [body] : [],
    )

    // 204, 205 y 304 no admiten cuerpo: construir el Response con uno lanzaría.
    // El shell manda un ArrayBuffer vacío igual, y CSS responde 205 a un PUT
    // que reemplaza un recurso: sin el 205, toda sobrescritura fallaba.
    const nullBody = [204, 205, 304].includes(result.status) || result.status < 200
    const response = new Response(nullBody ? null : (result.body ?? null), {
      status: result.status,
      statusText: result.statusText,
      headers: new Headers(result.headers),
    })

    // Un Response construido a mano tiene `.url === ''` — es de solo lectura
    // salvo por defineProperty. @inrupt/solid-client la necesita para resolver
    // referencias relativas del propio documento (`<>` en el Turtle): sin
    // esto, cualquier lectura del pod revienta con
    // "Failed to construct 'URL': Invalid base URL" en cuanto el parser
    // intenta resolver algo contra ''. `result.url` es la URL final que
    // resolvió main (por si hubo redirección); si el main antiguo no la manda
    // todavía, se cae a la que se pidió.
    Object.defineProperty(response, 'url', { value: result.url ?? request.url, configurable: true })
    return response
  }

  const storage = hello.session?.storageUrl ?? null
  const container = hello.container ?? null

  return {
    version: hello.shell ?? 'desconocida',
    session: hello.session ?? null,
    capabilities: hello.capabilities ?? {},
    fetch: espacioFetch,
    paths: {
      get storage() {
        return storage
      },
      /** Ruta dentro del contenedor propio de esta app en el pod del socio. */
      app(...segments) {
        if (!container) {
          throw new EspacioError('EspacioNoContainer', 'Esta app no tiene contenedor asignado')
        }
        if (segments.length === 0) return container
        const path = segments.join('/').replace(/^\/+/, '')
        // Los contenedores llevan barra final; los recursos, no.
        return new URL(path, container).href
      },
    },
    ui: {
      confirm: (options) => call(METHOD.UI_CONFIRM, options),
      notify: (options) => call(METHOD.UI_NOTIFY, options),
    },
    on(event, callback) {
      const set = listeners.get(event) ?? new Set()
      set.add(callback)
      listeners.set(event, set)
      return () => set.delete(callback)
    },
  }
}
