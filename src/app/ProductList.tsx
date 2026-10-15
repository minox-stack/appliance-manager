import type { ReactNode } from 'react';
import type { Product, SortKey } from '../types.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Icon } from '../ui/Icon.tsx';
import { ProductCard, ProductRow } from '../ui/ProductCard.tsx';
import { useFilters, useNav } from './context.ts';
import { useStore } from './store.tsx';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'الأحدث أولًا' },
  { value: 'name', label: 'الاسم (أ ← ي)' },
  { value: 'cashAsc', label: 'سعر الكاش: الأقل أولًا' },
  { value: 'cashDesc', label: 'سعر الكاش: الأعلى أولًا' },
  { value: 'instAsc', label: 'سعر التقسيط: الأقل أولًا' },
  { value: 'instDesc', label: 'سعر التقسيط: الأعلى أولًا' },
];

export function SortBar({ count, extra }: { count: number; extra?: ReactNode }) {
  const f = useFilters();
  return (
    <div className="sortbar">
      <span className="count">
        {count} {count === 1 ? 'جهاز' : 'أجهزة'}
      </span>
      <label className="sort">
        <span className="sr-only">ترتيب النتائج</span>
        <select className="input select" value={f.sort} onChange={(e) => f.setSort(e.target.value as SortKey)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {extra}
    </div>
  );
}

export function ProductList({ items, compact = false }: { items: Product[]; compact?: boolean }) {
  const { products, categoryName, toggleFavorite } = useStore();
  const nav = useNav();
  const f = useFilters();

  if (items.length === 0) {
    if (products.length === 0) {
      return (
        <EmptyState
          title="لا توجد أجهزة بعد"
          text="أضف أول جهاز لتسجيل سعر الكاش وسعر التقسيط."
        >
          <button type="button" className="btn btn-primary" onClick={() => nav.openEditor(null)}>
            <Icon name="plus" size={20} /> إضافة جهاز
          </button>
        </EmptyState>
      );
    }
    return (
      <EmptyState
        icon="search"
        title="لا توجد نتائج"
        text="جرّب كلمة أخرى، أو تحقق من الماركة أو رقم الموديل، أو غيّر التصنيف."
      >
        <button type="button" className="btn btn-ghost" onClick={f.reset}>
          مسح البحث والفلاتر
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="list">
      {items.map((p) =>
        compact ? (
          <ProductRow key={p.id} product={p} onOpen={nav.openDetail} onToggleFav={toggleFavorite} />
        ) : (
          <ProductCard
            key={p.id}
            product={p}
            categoryName={categoryName(p.categoryId)}
            onOpen={nav.openDetail}
            onEdit={nav.openEditor}
            onToggleFav={toggleFavorite}
          />
        ),
      )}
    </div>
  );
}
