import { useCallback, useEffect, useMemo, useState } from 'react';
import { extraerEnlaces, nombreDe, resolverEnlace } from './wikilinks';

// Índice de todas las notas del vault y sus enlaces: con él se resuelven los
// [[enlaces]], se arman los enlaces entrantes y el grafo.
//
// Se construye al abrir la app leyendo cada nota (de a CONCURRENCIA a la vez)
// y después se mantiene en memoria con lo que la app guarda, crea o borra.
// Límite conocido: con muchas notas la primera carga tarda; la siguiente
// versión podría cachearlo en Aplicaciones/notas/.

const CONCURRENCIA = 6;

async function enParalelo(items, n, fn) {
  let i = 0;
  const trabajadores = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(trabajadores);
}

export function useIndice(vault) {
  // ruta → destinos de sus enlaces (sin resolver)
  const [enlaces, setEnlaces] = useState(() => new Map());
  const [estado, setEstado] = useState({ cargando: true, leidas: 0, total: 0, error: null });
  // Cambiarla vuelve a leer todo el vault (botón "Recargar").
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const rutas = await vault.listarTodo();
        if (cancelado) return;
        // Al recargar se conservan los enlaces ya conocidos mientras se releen.
        setEnlaces((previo) => new Map(rutas.map((r) => [r, previo.get(r) ?? []])));
        setEstado({ cargando: true, leidas: 0, total: rutas.length, error: null });
        let leidas = 0;
        await enParalelo(rutas, CONCURRENCIA, async (r) => {
          try {
            const nota = await vault.leerNota(r);
            if (cancelado || !nota) return;
            const destinos = extraerEnlaces(nota.texto, r);
            setEnlaces((m) => (m.has(r) ? new Map(m).set(r, destinos) : m));
          } catch (err) {
            console.warn(`No se pudo indexar ${r}: ${err.message}`);
          }
          if (!cancelado) setEstado((e) => ({ ...e, leidas: ++leidas }));
        });
        if (!cancelado) setEstado((e) => ({ ...e, cargando: false }));
      } catch (err) {
        if (!cancelado) setEstado({ cargando: false, leidas: 0, total: 0, error: err.message });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [vault, version]);

  const rutas = useMemo(() => [...enlaces.keys()].sort((a, b) => a.localeCompare(b, 'es')), [enlaces]);

  // Aristas resueltas: { origen, destino } con destino = ruta existente, o
  // { origen, fantasma } si apunta a una nota que todavía no existe.
  const aristas = useMemo(() => {
    const lista = [];
    for (const [origen, destinos] of enlaces) {
      for (const d of destinos) {
        const destino = resolverEnlace(d, origen, rutas);
        if (destino === origen) continue;
        lista.push(destino ? { origen, destino } : { origen, fantasma: nombreDe(d) });
      }
    }
    return lista;
  }, [enlaces, rutas]);

  const actualizar = useCallback((ruta, texto) => {
    setEnlaces((m) => new Map(m).set(ruta, extraerEnlaces(texto, ruta)));
  }, []);

  // Quita una nota, o todas las de una carpeta si la ruta termina en "/".
  const quitar = useCallback((ruta) => {
    setEnlaces((m) => {
      const nuevo = new Map(m);
      for (const r of m.keys()) if (r === ruta || (ruta.endsWith('/') && r.startsWith(ruta))) nuevo.delete(r);
      return nuevo;
    });
  }, []);

  const renombrar = useCallback((desde, hacia) => {
    setEnlaces((m) => {
      const nuevo = new Map(m);
      const destinos = nuevo.get(desde) ?? [];
      nuevo.delete(desde);
      return nuevo.set(hacia, destinos);
    });
  }, []);

  const resolver = useCallback((destino, origen) => resolverEnlace(destino, origen, rutas), [rutas]);

  const entrantes = useCallback(
    (ruta) => [...new Set(aristas.filter((a) => a.destino === ruta).map((a) => a.origen))].sort(),
    [aristas]
  );

  return { rutas, aristas, estado, actualizar, quitar, renombrar, resolver, entrantes, recargar };
}
