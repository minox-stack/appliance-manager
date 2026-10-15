import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortKey } from '../types.ts';
import { ProductDetail } from '../screens/ProductDetail.tsx';
import { ProductEditor } from '../screens/ProductEditor.tsx';
import { Home } from '../screens/Home.tsx';
import { Catalog } from '../screens/Catalog.tsx';
import { Categories } from '../screens/Categories.tsx';
import { Settings } from '../screens/Settings.tsx';
import { BottomNav } from '../ui/BottomNav.tsx';
import { Icon } from '../ui/Icon.tsx';
import { ToastProvider } from '../ui/Toast.tsx';
import { FiltersContext, NavContext } from './context.ts';
import type { FiltersApi, NavApi, Tab } from './context.ts';
import { StoreProvider, useStore } from './store.tsx';

type OverlayState = { type: 'detail'; id: string } | { type: 'editor'; id: string | null };

/** يضبط متغيرات CSS على حجم الشاشة المرئي (فوق لوحة المفاتيح) حتى لا تغطي لوحة المفاتيح الأزرار. */
function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const update = () => {
      const keyboardOpen = window.innerHeight - vv.height > 120;
      if (keyboardOpen) {
        root.setProperty('--vv-h', `${Math.round(vv.height)}px`);
        root.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      } else {
        root.removeProperty('--vv-h');
        root.removeProperty('--vv-top');
      }
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}

function Shell() {
  const { ready, error, retry } = useStore();
  useVisualViewport();

  // ---- التصفية المشتركة بين الرئيسية والمنتجات ----
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');
  const reset = useCallback(() => {
    setQuery('');
    setCategoryId('all');
    setFavOnly(false);
  }, []);
  const filters = useMemo<FiltersApi>(
    () => ({
      query,
      categoryId,
      favOnly,
      sort,
      active: query.trim() !== '' || categoryId !== 'all' || favOnly,
      setQuery,
      setCategoryId,
      setFavOnly,
      setSort,
      reset,
    }),
    [query, categoryId, favOnly, sort, reset],
  );

  // ---- التنقل: تبويبات + صفحات فوقها، مع زر الرجوع/السحب في الآيفون ----
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<OverlayState[]>([]);
  const depth = useRef(0);
  depth.current = stack.length;

  const open = useCallback((o: OverlayState) => {
    window.history.pushState({ am: true }, '');
    setStack((s) => [...s, o]);
  }, []);
  const back = useCallback(() => {
    if (depth.current > 0) window.history.back();
  }, []);

  useEffect(() => {
    const onPop = () => setStack((s) => (s.length ? s.slice(0, -1) : s));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nav = useMemo<NavApi>(
    () => ({
      tab,
      setTab,
      openDetail: (id) => open({ type: 'detail', id }),
      openEditor: (id) => open({ type: 'editor', id }),
      back,
    }),
    [tab, open, back],
  );

  if (error) {
    return (
      <div className="splash">
        <Icon name="alert" size={40} />
        <h2>تعذّر تحميل البيانات</h2>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={retry}>
          إعادة المحاولة
        </button>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="splash" role="status">
        <div className="spinner" />
        <p>جارٍ تحميل البيانات…</p>
      </div>
    );
  }

  return (
    <NavContext.Provider value={nav}>
      <FiltersContext.Provider value={filters}>
        <div className="app">
          <main className="screen" key={tab}>
            {tab === 'home' && <Home />}
            {tab === 'products' && <Catalog />}
            {tab === 'categories' && <Categories />}
            {tab === 'settings' && <Settings />}
          </main>

          {(tab === 'home' || tab === 'products') && (
            <button type="button" className="fab" onClick={() => nav.openEditor(null)} aria-label="إضافة جهاز">
              <Icon name="plus" size={26} />
              <span>إضافة جهاز</span>
            </button>
          )}

          <BottomNav tab={tab} onChange={setTab} />

          {stack.map((o, i) =>
            o.type === 'detail' ? (
              <ProductDetail key={`d${i}-${o.id}`} id={o.id} />
            ) : (
              <ProductEditor key={`e${i}-${o.id ?? 'new'}`} id={o.id} />
            ),
          )}
        </div>
      </FiltersContext.Provider>
    </NavContext.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ToastProvider>
  );
}
