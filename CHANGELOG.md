# Changelog

Todos los cambios relevantes de este proyecto se documentan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-10-08

Primera versión: notas en Markdown enlazadas entre sí, al estilo de
Obsidian, guardadas en el Solid Pod del socio. Funciona suelta (login Solid
propio) y alojada en espacio (con `@tecnocoop/espacio-sdk`). Desplegar junto
con el manifiesto `notas` del catálogo de espacio.

### Añadido

- Vault en `<pod>/Documentos/`: árbol de carpetas y notas `.md` con carga
  perezosa por carpeta; crear, renombrar y borrar notas; crear y borrar
  carpetas (con todo su contenido, previa confirmación).
- Botón para recargar el árbol y el índice desde el pod; el árbol también se
  actualiza al volver a la pestaña.
- Editor Markdown (CodeMirror 6) y modo lectura con Markdown renderizado y
  sanitizado.
- Guardado en dos tiempos: cada cambio queda al instante en este equipo
  (borrador local) y se sincroniza con el pod 10 s después de dejar de
  escribir, al salir de la nota, al ocultar la pestaña o con Ctrl/Cmd+S. Si
  falla la red se reintenta solo, y un borrador sin sincronizar se recupera
  al volver a abrir la nota.
- Escritura condicional por ETag: si la nota cambió en el pod desde otro
  lado, aviso de conflicto con opción de recargar o sobrescribir.
- Enlaces entre notas `[[Nota]]`, `[[Carpeta/Nota]]`, `[[Nota#Sección|alias]]`
  y `[texto](otra.md)`, resueltos al estilo Obsidian; autocompletado al
  escribir `[[`; seguir un enlace a una nota que no existe la crea.
- Enlaces entrantes y grafo local de la nota abierta.
- Vista de grafo de todo el vault, con nodos para notas que todavía no
  existen; se cierra con ✕, Esc o Alt+G.
- Abrir nota por nombre (Ctrl/Cmd+O), con opción de crearla.
- Atajos de teclado (lista en Ctrl/Cmd+/): nueva nota, grafo, edición y
  lectura, guardar, panel lateral; en el editor, negrita, cursiva, tachado,
  enlaces, casillas de tarea y sangría con Tab.
- Preferencias (última nota, carpetas desplegadas) en
  `<pod>/Aplicaciones/notas/config.json`.
- Tema con los tokens de espacio, claro y oscuro.

### Corregido

- Copia de la SDK de espacio con el arreglo de las respuestas 205: dentro de
  espacio, sobrescribir un archivo fallaba aunque el pod lo hubiera guardado.
