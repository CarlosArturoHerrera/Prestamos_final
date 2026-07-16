"use client";

import { useCallback, useState } from "react";

/**
 * Caché en memoria del cliente para datos de página (stale-while-revalidate).
 *
 * El Map vive a nivel de módulo, por lo que sobrevive a las navegaciones del
 * App Router (mismo heap JS) pero no a un refresh completo del navegador.
 * Las páginas siembran su estado inicial desde aquí para pintar al instante
 * en revisitas, mientras su efecto de carga habitual revalida en segundo plano.
 */
const cache = new Map<string, unknown>();

export function pageCacheHas(key: string): boolean {
  return cache.has(key);
}

/**
 * Igual que useState, pero con write-through a la caché de página.
 * El tercer elemento indica si había un valor cacheado al montar
 * (útil para sembrar `loading` en false y evitar skeletons en revisitas).
 */
export function usePageCachedState<T>(key: string, initial: T) {
  const [hadCache] = useState(() => cache.has(key));
  const [value, setValue] = useState<T>(() =>
    cache.has(key) ? (cache.get(key) as T) : initial,
  );

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        cache.set(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, set, hadCache] as const;
}
