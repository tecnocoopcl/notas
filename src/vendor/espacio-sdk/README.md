# @tecnocoop/espacio-sdk (vendorizado)

Copia local de la SDK de [espacio](https://github.com/tecnocoopcl/espacio),
`packages/sdk/src/` en ese repo, versión **0.1.0**.

## Por qué está copiada y no como dependencia de npm

Por ahora es información interna de la cooperativa, no algo que deba
publicarse en el registro público de npm. Todavía no hay un registro privado
montado, así que mientras tanto se vendoriza: es código sin dependencias
(cero paquetes de terceros) y sin paso de build, así que copiarlo tal cual no
tiene coste real. Cuando exista un registro privado (npm con org de pago,
GitHub Packages privado, o un Verdaccio propio de la cooperativa), esto vuelve
a ser una dependencia normal en `package.json` y este directorio se borra.

## Cómo actualizarla

No se edita a mano. Se copia de nuevo desde el repo de espacio:

```bash
cp ../espacio/packages/sdk/src/{index,protocol}.{js,d.ts} src/vendor/espacio-sdk/
```

y se revisa el diff — un cambio de protocolo aquí implica que el shell y esta
copia pueden desincronizarse. El propio protocolo negocia versión en cada
conexión (`manifest.sdk` en el catálogo de espacio, comparado con el `sdk` que
esta copia anuncia en el saludo — ver `SDK_VERSION` en `protocol.js`), así que
una copia desactualizada se detecta en vez de fallar en silencio.
