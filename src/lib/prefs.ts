import { useSyncExternalStore } from 'react';

/** تفضيلات صغيرة فقط (localStorage). المنتجات والصور تُحفظ في IndexedDB. */
export interface Prefs {
  ownerName: string;
  shopName: string;
  lastBackupAt: number | null;
}

const KEY = 'am:prefs:v1';
const defaults: Prefs = { ownerName: '', shopName: '', lastBackupAt: null };

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      ownerName: typeof p.ownerName === 'string' ? p.ownerName : '',
      shopName: typeof p.shopName === 'string' ? p.shopName : '',
      lastBackupAt: typeof p.lastBackupAt === 'number' ? p.lastBackupAt : null,
    };
  } catch {
    return { ...defaults };
  }
}

let current: Prefs = load();
const listeners = new Set<() => void>();

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* التخزين غير متاح: نتجاهل بهدوء */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, () => current);
}
