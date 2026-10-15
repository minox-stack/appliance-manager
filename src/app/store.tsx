import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { db } from '../db/database.ts';
import * as repo from '../db/repo.ts';
import type { ImageChange, ProductInput } from '../db/repo.ts';
import type { Category, Product } from '../types.ts';
import { friendlyError } from '../lib/errors.ts';
import { requestPersistence } from '../lib/storage.ts';
import { useToast } from '../ui/Toast.tsx';

interface State {
  ready: boolean;
  error: string | null;
  products: Product[];
  categories: Category[];
}

export interface StoreApi extends State {
  categoryName: (id: string) => string;
  retry: () => void;
  reload: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  saveProduct: (input: ProductInput, change: ImageChange) => Promise<Product | null>;
  deleteProduct: (id: string) => Promise<boolean>;
  addCategory: (name: string) => Promise<boolean>;
  renameCategory: (id: string, name: string) => Promise<boolean>;
  deleteCategory: (id: string, moveToId: string) => Promise<number | null>;
}

const Ctx = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider غير متوفر');
  return v;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<State>({ ready: false, error: null, products: [], categories: [] });
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    const d = await repo.loadAll();
    setState((s) => ({ ...s, ready: true, error: null, products: d.products, categories: d.categories }));
  }, []);

  const init = useCallback(async () => {
    setState((s) => ({ ...s, ready: false, error: null }));
    try {
      await db.open();
      await reload();
      void requestPersistence();
    } catch (e) {
      setState((s) => ({ ...s, ready: false, error: friendlyError(e) }));
    }
  }, [reload]);

  useEffect(() => {
    void init();
  }, [init]);

  const fail = useCallback(
    (e: unknown) => {
      toast(friendlyError(e), 'error');
    },
    [toast],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const cur = stateRef.current.products.find((p) => p.id === id);
      if (!cur) return;
      const next: 0 | 1 = cur.favorite === 1 ? 0 : 1;
      setState((s) => ({ ...s, products: s.products.map((p) => (p.id === id ? { ...p, favorite: next } : p)) }));
      try {
        await repo.setFavorite(id, next);
      } catch (e) {
        fail(e);
        await reload().catch(() => undefined);
      }
    },
    [fail, reload],
  );

  const saveProduct = useCallback<StoreApi['saveProduct']>(
    async (input, change) => {
      try {
        const p = await repo.saveProduct(input, change);
        await reload();
        toast(input.id ? 'تم تحديث الجهاز' : 'تم حفظ الجهاز');
        return p;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [fail, reload, toast],
  );

  const deleteProduct = useCallback<StoreApi['deleteProduct']>(
    async (id) => {
      try {
        await repo.deleteProduct(id);
        await reload();
        toast('تم حذف الجهاز');
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [fail, reload, toast],
  );

  const addCategory = useCallback<StoreApi['addCategory']>(
    async (name) => {
      try {
        await repo.addCategory(name);
        await reload();
        toast('تمت إضافة التصنيف');
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [fail, reload, toast],
  );

  const renameCategory = useCallback<StoreApi['renameCategory']>(
    async (id, name) => {
      try {
        await repo.renameCategory(id, name);
        await reload();
        toast('تم تغيير اسم التصنيف');
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    [fail, reload, toast],
  );

  const deleteCategory = useCallback<StoreApi['deleteCategory']>(
    async (id, moveToId) => {
      try {
        const moved = await repo.deleteCategory(id, moveToId);
        await reload();
        toast('تم حذف التصنيف');
        return moved;
      } catch (e) {
        fail(e);
        return null;
      }
    },
    [fail, reload, toast],
  );

  const value = useMemo<StoreApi>(() => {
    const names = new Map(state.categories.map((c) => [c.id, c.name]));
    return {
      ...state,
      categoryName: (id: string) => names.get(id) ?? 'أخرى',
      retry: () => void init(),
      reload,
      toggleFavorite,
      saveProduct,
      deleteProduct,
      addCategory,
      renameCategory,
      deleteCategory,
    };
  }, [state, init, reload, toggleFavorite, saveProduct, deleteProduct, addCategory, renameCategory, deleteCategory]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
