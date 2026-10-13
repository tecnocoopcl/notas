# Notas

Notas en Markdown enlazadas entre sí, al estilo de Obsidian, guardadas en el
Solid Pod de cada socio. Sigue el mismo patrón que música y por-hacer: la
misma build funciona suelta (con su propio login Solid) y alojada en
**espacio** (con la sesión que le presta el escritorio).

## Qué hace (v0.1)

- Navegar las carpetas y notas del vault; crear, renombrar y borrar.
- Editar en Markdown (CodeMirror) con autoguardado local y sincronización diferida; alternar edición y
  lectura con Ctrl/Cmd+E. La lectura es una vista previa en vivo: la nota se ve renderizada y se edita
  ahí mismo (el Markdown aparece solo en la línea del cursor; las casillas se marcan con un clic).
  Ctrl/Cmd+S guarda en el acto.
- Enlazar notas con `[[Nota]]` (autocompleta al escribir `[[`). Ctrl/Cmd+clic
  sigue un enlace en el editor; en lectura basta un clic. Si la nota no
  existe, se crea junto a la que enlaza (o desde la raíz si el enlace lleva
  carpeta: `[[Proyectos/Idea]]`).
- Enlaces entrantes y grafo local de cada nota; grafo de todo el vault en
  `/grafo` (Alt+G o Esc para cerrarlo).
- Atajos de teclado: la lista está en la app (Ctrl/Cmd+/) y en
  `src/componentes/Atajos.jsx`. Chrome se reserva algunos (Ctrl/Cmd+N, +G,
  +1…9), por eso nueva nota y grafo usan Alt.
- El árbol se recarga al volver a la pestaña y con el botón ⟳ (que además
  relee todas las notas para el índice de enlaces).

## Dónde se guarda cada cosa

Según la convención de carpetas de espacio (ADR-016 y ADR-017):

| Qué | Dónde |
|---|---|
| Las notas (`.md`) y sus carpetas | `<pod>/Documentos/` |
| Preferencias: última nota, carpetas desplegadas | `<pod>/Aplicaciones/notas/config.json` |

Las notas son documentos del socio: se ven en Archivos y se pueden abrir
también con escribir. Notas solo muestra carpetas y archivos `.md`; lo demás
que haya en `Documentos/` no se toca (salvo al borrar una carpeta entera).

**Guardado.** Cada cambio queda al instante en este equipo (un borrador en
`localStorage`, `src/notas/borradores.js`) y se sincroniza con el pod 10 s
después de dejar de escribir, al cambiar de nota, al ocultar la pestaña o con
Ctrl/Cmd+S. Si la red falla se reintenta cada 30 s, y un borrador que no
alcanzó a subir se recupera la próxima vez que se abre la nota en ese equipo.

Las escrituras son condicionales (`If-Match` con el ETag de la última
lectura): si la nota cambió en otro dispositivo, la app avisa del conflicto
en vez de pisarla.

## Rutas

| Ruta | Vista |
|---|---|
| `/` | Abre la última nota, o la portada |
| `/nota/<ruta>` | Una nota, p. ej. `/nota/Proyectos/Mi%20idea.md` |
| `/grafo` | Grafo de todo el vault |

## Enlaces

| Sintaxis | Resuelve a |
|---|---|
| `[[Nota]]` | La nota con ese nombre en cualquier carpeta; si hay varias, la más cercana |
| `[[Carpeta/Nota]]` | Relativa a la nota, después desde la raíz, después por sufijo |
| `[[Nota#Sección\|alias]]` | La sección y el alias no cambian el destino |
| `[texto](otra%20nota.md)` | Relativa a la carpeta de la nota |

La lógica está en `src/notas/wikilinks.js`, con pruebas en `test/`.

Límites conocidos de esta versión: renombrar una nota no actualiza los
enlaces que apuntan a ella, y el índice de enlaces se reconstruye leyendo
todas las notas en cada carga.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5180
npm test        # pruebas de wikilinks
npm run lint
npm run build
```

El puerto es 5180 porque el 5173 lo usa el shell de espacio en desarrollo.

**Suelta:** abre `http://localhost:5180` y conecta con tu WebID o proveedor
(por defecto `https://pods-rpi-tc.aebn.cl`).

**Dentro de espacio:** el manifiesto está en
`espacio/packages/catalog/apps/notas.json` (contenedor `Documentos/`, más
`Aplicaciones/notas/`). Para que el shell en desarrollo cargue esta app desde
localhost, en la raíz de espacio:

```json
// .espacio-dev.json (ignorado por git)
{ "notas": "http://localhost:5180" }
```

### SDK de espacio

`src/vendor/espacio-sdk/` es una copia de `espacio/packages/sdk/src/`. No se
edita aquí: se corrige allá y se vuelve a copiar.

```bash
cp ../../espacio/packages/sdk/src/{index,protocol}.{js,d.ts} src/vendor/espacio-sdk/
```

## Despliegue

GitHub Pages desde `main` (`.github/workflows/deploy.yml`). El workflow copia
`index.html` a `404.html` para que `/nota/<ruta>` y `/grafo` carguen la app.
