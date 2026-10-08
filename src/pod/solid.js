import {
  login,
  logout,
  handleIncomingRedirect,
  getDefaultSession,
  fetch as solidFetch,
} from '@inrupt/solid-client-authn-browser';
import { getPodUrlAll, getSolidDataset, getThing, getUrlAll } from '@inrupt/solid-client';

// Dos formas de tener sesión, como música y por-hacer:
//
// - **Suelta** (notas.aebn.cl): sesión Solid propia con
//   solid-client-authn-browser.
// - **Dentro de espacio**: el escritorio ya tiene la sesión del socio y presta
//   un fetch acotado a lo que declara el manifiesto: <pod>/Documentos/ (las
//   notas) y <pod>/Aplicaciones/notas/ (lo de la app). main.jsx deja la
//   conexión en window.__espacio. No hay login propio: el redirect al
//   proveedor ni siquiera podría cargarse en el iframe.

export const PROVEEDOR_POR_DEFECTO = 'https://pods-rpi-tc.aebn.cl';

const SOLID_OIDC_ISSUER = 'http://www.w3.org/ns/solid/terms#oidcIssuer';
const VOLVER_KEY = 'notas-volver-a';

// Convención de carpetas de espacio (ADR-016/017): las notas son documentos
// del socio y se ven en Archivos; lo que es de la app, aparte.
const CARPETA_VAULT = 'Documentos/';
const CARPETA_APP = 'Aplicaciones/notas/';

const espacio = () => window.__espacio ?? null;

export function enEspacio() {
  return Boolean(espacio());
}

export const podFetch = (...args) => (espacio() ? espacio().fetch(...args) : solidFetch(...args));

export function sesionActual() {
  if (espacio()) {
    const webId = espacio().session?.webId ?? null;
    return { conectada: Boolean(webId), webId, embebida: true };
  }
  const { info } = getDefaultSession();
  return { conectada: info.isLoggedIn, webId: info.isLoggedIn ? info.webId : null, embebida: false };
}

// Avisos breves: dentro de espacio los muestra el shell; suelta, el componente
// Avisos de la app (escucha este evento).
export function avisar(message, tone = 'info') {
  if (espacio()) return espacio().ui.notify({ message, tone }).catch(() => {});
  window.dispatchEvent(new CustomEvent('notas:aviso', { detail: { message, tone } }));
}

// window.confirm no funciona en el iframe de espacio (no tiene allow-modals):
// devuelve null sin avisar, que es peor que un error.
export async function confirmar(message, { title, confirmLabel = 'Borrar' } = {}) {
  if (espacio()) return Boolean(await espacio().ui.confirm({ title, message, confirmLabel, danger: true }));
  return window.confirm(message);
}

// Se llama una vez antes de montar la app: completa el login si volvemos del
// proveedor, o restaura la sesión anterior.
export async function iniciarSesion() {
  if (espacio()) return sesionActual();
  try {
    await handleIncomingRedirect({
      restorePreviousSession: true,
      onSessionRestore: (url) => volverA(new URL(url).pathname),
    });
  } catch (err) {
    console.warn(`No se pudo restaurar la sesión Solid: ${err.message}`);
  }
  const pendiente = sessionStorage.getItem(VOLVER_KEY);
  if (pendiente) {
    sessionStorage.removeItem(VOLVER_KEY);
    volverA(pendiente);
  }
  return sesionActual();
}

function volverA(pathname) {
  if (pathname && pathname !== window.location.pathname) window.history.replaceState(null, '', pathname);
}

// Acepta un WebID (https://…/profile/card#me) o directamente la URL del
// proveedor. Con un WebID, el proveedor sale de solid:oidcIssuer del perfil.
export async function resolverProveedor(entrada) {
  const valor = entrada.trim();
  const url = new URL(valor.includes('://') ? valor : `https://${valor}`);
  if (!url.hash) return url.origin;

  const perfil = await getSolidDataset(url.href);
  const yo = getThing(perfil, url.href);
  const [proveedor] = yo ? getUrlAll(yo, SOLID_OIDC_ISSUER) : [];
  if (!proveedor) throw new Error('Ese WebID no declara un proveedor de identidad (solid:oidcIssuer).');
  return proveedor;
}

export async function conectar(oidcIssuer) {
  // Siempre se vuelve a la raíz (es index.html en GitHub Pages) y desde ahí a
  // la página en que estaba, para no depender de 404.html en el callback.
  sessionStorage.setItem(VOLVER_KEY, window.location.pathname);
  await login({
    oidcIssuer,
    redirectUrl: `${window.location.origin}/`,
    clientName: 'Notas',
  });
}

export async function desconectar() {
  await logout();
}

// Devuelve { vault, app }: la carpeta de las notas y la de la app.
export async function resolverRaices(webId) {
  // Dentro de espacio el contenedor principal del manifiesto es Documentos/,
  // y la raíz del pod la da el escritorio desde el pim:storage real del socio.
  if (espacio()) {
    const vault = espacio().paths.app();
    // storageUrl puede venir vacío; el contenedor siempre cuelga de la raíz.
    const raiz = espacio().paths.storage ? conBarra(espacio().paths.storage) : vault.slice(0, -CARPETA_VAULT.length);
    return { vault, app: raiz + CARPETA_APP };
  }
  // El perfil se lee aquí y se le pasa ya leído: getPodUrlAll de
  // solid-client 1.23 lo pide con el fetch de cross-fetch, que en el
  // navegador es window.fetch sin su `this`, y revienta con "Can only call
  // Window.fetch on instances of Window" (Safari) o "Illegal invocation".
  const webIdProfile = await getSolidDataset(webId, { fetch: solidFetch });
  const [pod] = await getPodUrlAll(webId, { fetch: solidFetch, webIdProfile });
  if (!pod) {
    throw new Error(`El perfil ${webId} no declara pim:storage; no se sabe dónde está tu pod.`);
  }
  const raiz = conBarra(pod);
  return { vault: raiz + CARPETA_VAULT, app: raiz + CARPETA_APP };
}

const conBarra = (url) => (url.endsWith('/') ? url : `${url}/`);
