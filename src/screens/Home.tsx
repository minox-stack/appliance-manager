import { useMemo } from 'react';
import { ProductList, SortBar } from '../app/ProductList.tsx';
import { useFilters, useNav } from '../app/context.ts';
import { useStore } from '../app/store.tsx';
import { useBrowse } from '../app/useBrowse.ts';
import { usePrefs } from '../lib/prefs.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { FilterChips } from '../ui/FilterChips.tsx';
import { Icon } from '../ui/Icon.tsx';
import { ProductRow } from '../ui/ProductCard.tsx';
import { SearchBar } from '../ui/SearchBar.tsx';

function greeting(name: string): string {
  const h = new Date().getHours();
  const g = h < 12 ? 'صباح الخير' : 'مساء الخير';
  return name.trim() ? `${g}، ${name.trim()}` : g;
}

export function Home() {
  const { products, categories, toggleFavorite } = useStore();
  const nav = useNav();
  const f = useFilters();
  const prefs = usePrefs();
  const results = useBrowse();

  const recent = useMemo(() => [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5), [products]);
  const favorites = useMemo(
    () => products.filter((p) => p.favorite === 1).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [products],
  );
  const favCount = useMemo(() => products.filter((p) => p.favorite === 1).length, [products]);

  return (
    <>
      <header className="home-head">
        <p className="greet">{greeting(prefs.ownerName)}</p>
        <h1 className="title">{prefs.shopName.trim() || 'مخزون الأجهزة'}</h1>
      </header>

      <SearchBar large value={f.query} onChange={f.setQuery} />

      <FilterChips
        categories={categories}
        categoryId={f.categoryId}
        onCategory={f.setCategoryId}
        favOnly={f.favOnly}
        onFavOnly={f.setFavOnly}
      />

      {f.active ? (
        <section aria-label="نتائج البحث">
          <SortBar
            count={results.length}
            extra={
              <button type="button" className="link-btn" onClick={f.reset}>
                مسح
              </button>
            }
          />
          <ProductList items={results} compact />
        </section>
      ) : (
        <>
          <section className="stats" aria-label="ملخص المخزون">
            <button type="button" className="stat surface pressable" onClick={() => nav.setTab('products')}>
              <strong>{products.length}</strong>
              <span>جهاز مسجّل</span>
            </button>
            <button type="button" className="stat surface pressable" onClick={() => nav.setTab('categories')}>
              <strong>{categories.length}</strong>
              <span>تصنيف</span>
            </button>
            <button
              type="button"
              className="stat surface pressable"
              onClick={() => favCount > 0 && f.setFavOnly(true)}
              aria-label={`${favCount} في المفضلة`}
            >
              <strong>{favCount}</strong>
              <span>في المفضلة</span>
            </button>
          </section>

          {products.length === 0 ? (
            <EmptyState title="ابدأ بتسجيل أجهزتك" text="أضف الجهاز بسعر الكاش وسعر التقسيط، ثم ابحث عنه في ثوانٍ.">
              <button type="button" className="btn btn-primary" onClick={() => nav.openEditor(null)}>
                <Icon name="plus" size={20} /> إضافة جهاز
              </button>
            </EmptyState>
          ) : (
            <>
              <section>
                <div className="sec-head">
                  <h2>أُضيفت مؤخرًا</h2>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      f.setSort('newest');
                      nav.setTab('products');
                    }}
                  >
                    عرض الكل
                  </button>
                </div>
                <div className="list">
                  {recent.map((p) => (
                    <ProductRow key={p.id} product={p} onOpen={nav.openDetail} onToggleFav={toggleFavorite} />
                  ))}
                </div>
              </section>

              {favorites.length > 0 && (
                <section>
                  <div className="sec-head">
                    <h2>المفضلة</h2>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        f.setFavOnly(true);
                        nav.setTab('products');
                      }}
                    >
                      عرض الكل
                    </button>
                  </div>
                  <div className="list">
                    {favorites.map((p) => (
                      <ProductRow key={p.id} product={p} onOpen={nav.openDetail} onToggleFav={toggleFavorite} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
