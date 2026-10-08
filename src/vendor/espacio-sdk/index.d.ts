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
  on(event: 'session-changed' | 'theme-changed', callback: (value: unknown) => void): () => void
}

export declare function isEmbedded(): boolean
export declare function connect(options?: { timeout?: number }): Promise<Espacio | null>
