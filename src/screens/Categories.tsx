import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useFilters, useNav } from '../app/context.ts';
import { useStore } from '../app/store.tsx';
import { OTHER_CATEGORY_ID } from '../types.ts';
import type { Category } from '../types.ts';
import { Icon } from '../ui/Icon.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export function Categories() {
  const { categories, products, addCategory, renameCategory, deleteCategory } = useStore();
  const nav = useNav();
  const f = useFilters();

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState(OTHER_CATEGORY_ID);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.categoryId, (m.get(p.categoryId) ?? 0) + 1);
    return m;
  }, [products]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    const ok = await addCategory(newName);
    setAdding(false);
    if (ok) setNewName('');
  };

  const startRename = (c: Category) => {
    setRenaming(c);
    setRenameValue(c.name);
  };
  const submitRename = async () => {
    if (!renaming) return;
    setBusy(true);
    const ok = await renameCategory(renaming.id, renameValue);
    setBusy(false);
    if (ok) setRenaming(null);
  };

  const startDelete = (c: Category) => {
    setDeleting(c);
    setMoveTo(OTHER_CATEGORY_ID);
  };
  const submitDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const moved = await deleteCategory(deleting.id, moveTo);
    setBusy(false);
    if (moved !== null) {
      if (f.categoryId === deleting.id) f.setCategoryId('all');
      setDeleting(null);
    }
  };

  const deletingCount = deleting ? (counts.get(deleting.id) ?? 0) : 0;
  const targets = categories.filter((c) => c.id !== deleting?.id);
  const moveToName = categories.find((c) => c.id === moveTo)?.name ?? 'أخرى';

  return (
    <>
      <header className="page-head">
        <h1 className="title">التصنيفات</h1>
        <p className="muted">اضغط على تصنيف لعرض أجهزته.</p>
      </header>

      <form className="add-cat surface" onSubmit={onAdd}>
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="تصنيف جديد (مثال: غسالات صحون)"
          maxLength={40}
          aria-label="اسم التصنيف الجديد"
          enterKeyHint="done"
        />
        <button type="submit" className="btn btn-primary" disabled={adding || !newName.trim()}>
          <Icon name="plus" size={20} /> إضافة
        </button>
      </form>

      <ul className="cats">
        {categories.map((c) => (
          <li key={c.id} className="cat surface">
            <button
              type="button"
              className="cat-main pressable"
              onClick={() => {
                f.setCategoryId(c.id);
                f.setFavOnly(false);
                nav.setTab('products');
              }}
            >
              <span className="cat-name">{c.name}</span>
              <span className="cat-count">{counts.get(c.id) ?? 0}</span>
            </button>
            <button type="button" className="icon-btn" aria-label={`تغيير اسم ${c.name}`} onClick={() => startRename(c)}>
              <Icon name="pencil" size={20} />
            </button>
            {c.id !== OTHER_CATEGORY_ID ? (
              <button
                type="button"
                className="icon-btn danger-text"
                aria-label={`حذف ${c.name}`}
                onClick={() => startDelete(c)}
              >
                <Icon name="trash" size={20} />
              </button>
            ) : (
              <span className="icon-btn-spacer" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>

      {/* ---- تغيير الاسم ---- */}
      <Sheet
        open={renaming !== null}
        title="تغيير اسم التصنيف"
        onClose={() => setRenaming(null)}
        footer={
          <div className="foot-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setRenaming(null)} disabled={busy}>
              إلغاء
            </button>
            <button type="button" className="btn btn-primary" onClick={submitRename} disabled={busy || !renameValue.trim()}>
              حفظ
            </button>
          </div>
        }
      >
        <input
          className="input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          maxLength={40}
          aria-label="الاسم الجديد"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submitRename();
          }}
        />
      </Sheet>

      {/* ---- الحذف الآمن ---- */}
      <Sheet
        open={deleting !== null}
        title={`حذف «${deleting?.name ?? ''}»`}
        onClose={() => setDeleting(null)}
        footer={
          <div className="foot-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)} disabled={busy}>
              إلغاء
            </button>
            <button type="button" className="btn btn-danger" onClick={submitDelete} disabled={busy}>
              {busy ? 'لحظة…' : 'حذف التصنيف'}
            </button>
          </div>
        }
      >
        {deletingCount > 0 ? (
          <>
            <p className="sheet-text">
              يحتوي هذا التصنيف على <strong>{deletingCount}</strong> {deletingCount === 1 ? 'جهاز' : 'أجهزة'}. لن تُحذف
              الأجهزة، بل ستُنقل إلى التصنيف الذي تختاره:
            </p>
            <label className="field">
              <span className="sr-only">نقل الأجهزة إلى</span>
              <select className="input select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {targets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id === OTHER_CATEGORY_ID ? `${c.name} (الافتراضي)` : c.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">سيتم نقل {deletingCount} إلى «{moveToName}» ثم حذف التصنيف.</p>
          </>
        ) : (
          <p className="sheet-text">هذا التصنيف فارغ، وسيُحذف مباشرة دون التأثير على أي جهاز.</p>
        )}
      </Sheet>
    </>
  );
}
