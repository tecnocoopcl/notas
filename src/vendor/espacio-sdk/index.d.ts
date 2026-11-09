export declare const SDK_VERSION: string

export declare class EspacioError extends Error {
  status?: number
}

export interface EspacioSession {
  webId: string
  issuer: string
  storageUrl: string | null
}

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface NotifyOptions {
  message: string
  tone?: 'info' | 'error'
}

export interface Espacio {
  version: string
  session: EspacioSession | null
  capabilities: Record<string, unknown>
  /** `fetch` autenticado; compatible con la firma que espera @inrupt/solid-client. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  paths: {
    readonly storage: string | null
    /** Ruta dentro del contenedor propio de esta app en el pod del socio. */
    app(...segments: string[]): string
  }
  ui: {
    confirm(options: ConfirmOptions): Promise<boolean>
    notify(options: NotifyOptions): Promise<void>
  }
  /**
   * Avisa al socio (sin `para`) o a otros socios. Requiere `notify: true` en las
   * capacidades del manifiesto; un shell anterior a la SDK 0.2.0 rechaza la llamada.
   */
  notificar(options: { para?: string | string[]; titulo: string; texto?: string; url?: string }): Promise<void>
  /**
   * Cuenta algo hecho en la app; `n` por defecto 1 (entero entre 1 y 1000). El
   * `tipo` debe estar declarado en `capabilities.activity`. Los datos quedan en
   * este equipo y alimentan lo que Inicio muestra del día.
   */
  actividad(options: { tipo: string; n?: number }): Promise<void>
  on(event: 'session-changed' | 'theme-changed', callback: (value: unknown) => void): () => void
}

export declare function isEmbedded(): boolean
export declare function connect(options?: { timeout?: number }): Promise<Espacio | null>
