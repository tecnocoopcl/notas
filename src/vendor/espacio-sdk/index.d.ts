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
  /**
   * `theme-changed` llega al conectar y cada vez que el socio cambia el tema; la
   * SDK ya lo aplicó al documento (ver `applyTheme`). Quien se suscribe tarde
   * recibe el último al suscribirse.
   */
  on(event: 'session-changed', callback: (value: unknown) => void): () => void
  on(event: 'theme-changed', callback: (value: EspacioTheme) => void): () => void
}

/** El tema del socio en espacio (ADR-034). */
export interface EspacioTheme {
  tema: 'claro' | 'oscuro'
  contraste: boolean
  /** Valor de cada variable de THEME_VARIABLES (`--esp-bg`, `--esp-text`, …). */
  variables: Record<string, string>
}

/** Aplica un tema a <html>: variables `--esp-*`, `color-scheme` y `data-esp-tema`. */
export declare function applyTheme(value: unknown, root?: HTMLElement): void

export declare function isEmbedded(): boolean
export declare function connect(options?: { timeout?: number }): Promise<Espacio | null>
