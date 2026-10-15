import { useMemo } from 'react';
import { applyFilters, buildHaystack } from '../lib/search.ts';
import type { Product } from '../types.ts';
import { useFilters } from './context.ts';
import { useStore } from './store.tsx';

/** نتائج البحث/التصفية الحالية (تتحدث فورًا مع كل حرف). */
export function useBrowse(): Product[] {
  const { products, categories } = useStore();
  const f = useFilters();

  const hay = useMemo(() => {
    const names = new Map(categories.map((c) => [c.id, c.name]));
    return new Map(products.map((p) => [p.id, buildHaystack(p, names.get(p.categoryId) ?? '')]));
  }, [products, categories]);

  return useMemo(
    () => applyFilters(products, hay, { query: f.query, categoryId: f.categoryId, favOnly: f.favOnly, sort: f.sort }),
    [products, hay, f.query, f.categoryId, f.favOnly, f.sort],
  );
}
