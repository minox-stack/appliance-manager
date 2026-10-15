import { ProductList, SortBar } from '../app/ProductList.tsx';
import { useFilters } from '../app/context.ts';
import { useStore } from '../app/store.tsx';
import { useBrowse } from '../app/useBrowse.ts';
import { FilterChips } from '../ui/FilterChips.tsx';
import { SearchBar } from '../ui/SearchBar.tsx';

export function Catalog() {
  const { categories, products } = useStore();
  const f = useFilters();
  const results = useBrowse();

  return (
    <>
      <header className="page-head">
        <h1 className="title">المنتجات</h1>
        <p className="muted">كل الأجهزة المسجّلة ({products.length})</p>
      </header>

      <SearchBar value={f.query} onChange={f.setQuery} />

      <FilterChips
        categories={categories}
        categoryId={f.categoryId}
        onCategory={f.setCategoryId}
        favOnly={f.favOnly}
        onFavOnly={f.setFavOnly}
      />

      <SortBar
        count={results.length}
        extra={
          f.active ? (
            <button type="button" className="link-btn" onClick={f.reset}>
              مسح
            </button>
          ) : null
        }
      />

      <ProductList items={results} />
    </>
  );
}
