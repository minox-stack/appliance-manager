import { createContext, useContext } from 'react';
import type { SortKey } from '../types.ts';

export type Tab = 'home' | 'products' | 'categories' | 'settings';

export interface NavApi {
  tab: Tab;
  setTab: (t: Tab) => void;
  openDetail: (id: string) => void;
  openEditor: (id: string | null) => void;
  back: () => void;
}

export const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const v = useContext(NavContext);
  if (!v) throw new Error('NavContext غير متوفر');
  return v;
}

export interface FiltersApi {
  query: string;
  categoryId: string;
  favOnly: boolean;
  sort: SortKey;
  /** هل هناك بحث أو تصفية فعّالة؟ */
  active: boolean;
  setQuery: (v: string) => void;
  setCategoryId: (v: string) => void;
  setFavOnly: (v: boolean) => void;
  setSort: (v: SortKey) => void;
  reset: () => void;
}

export const FiltersContext = createContext<FiltersApi | null>(null);

export function useFilters(): FiltersApi {
  const v = useContext(FiltersContext);
  if (!v) throw new Error('FiltersContext غير متوفر');
  return v;
}
