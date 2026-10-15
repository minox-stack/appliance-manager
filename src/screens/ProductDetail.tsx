import { useRef, useState } from 'react';
import { useNav } from '../app/context.ts';
import { useStore } from '../app/store.tsx';
import { formatDate } from '../lib/format.ts';
import type { Product } from '../types.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Icon } from '../ui/Icon.tsx';
import { Overlay } from '../ui/Overlay.tsx';
import { Price } from '../ui/Price.tsx';
import { ProductImage } from '../ui/ProductImage.tsx';
import { ConfirmSheet } from '../ui/Sheet.tsx';

export function ProductDetail({ id }: { id: string }) {
  const { products, categoryName, toggleFavorite, deleteProduct } = useStore();
  const nav = useNav();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // نحتفظ بآخر نسخة حتى لا تومض الصفحة فارغة أثناء الحذف والرجوع.
  const live = products.find((p) => p.id === id);
  const last = useRef<Product | undefined>(live);
  if (live) last.current = live;
  const product = live ?? last.current;

  if (!product) {
    return (
      <Overlay title="تفاصيل الجهاز" onBack={nav.back}>
        <EmptyState icon="alert" title="هذا الجهاز غير موجود" text="ربما تم حذفه." />
      </Overlay>
    );
  }

  const on = product.favorite === 1;
  const onDelete = async () => {
    setBusy(true);
    const ok = await deleteProduct(product.id);
    setBusy(false);
    if (ok) {
      setConfirm(false);
      nav.back();
    }
  };

  return (
    <Overlay
      title="تفاصيل الجهاز"
      onBack={nav.back}
      extra={
        <button
          type="button"
          className={`icon-btn fav ${on ? 'fav-on' : ''}`}
          aria-pressed={on}
          aria-label={on ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          onClick={() => toggleFavorite(product.id)}
        >
          <Icon name="heart" filled={on} />
        </button>
      }
      footer={
        <div className="foot-actions">
          <button type="button" className="btn btn-ghost" onClick={() => nav.openEditor(product.id)}>
            <Icon name="pencil" size={20} /> تعديل
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
            <Icon name="trash" size={20} /> حذف
          </button>
        </div>
      }
    >
      <ProductImage product={product} full />

      <h2 className="detail-name">{product.name}</h2>
      <p className="muted">
        {[product.brand, product.model].filter(Boolean).length ? (
          <bdi>{[product.brand, product.model].filter(Boolean).join(' · ')}</bdi>
        ) : (
          'بدون ماركة أو موديل'
        )}
      </p>
      <span className="chip chip-static">{categoryName(product.categoryId)}</span>

      <div className="prices prices-big">
        <div className="pbox cash">
          <span className="plabel">سعر الكاش</span>
          <Price value={product.cashPrice} />
        </div>
        <div className="pbox inst">
          <span className="plabel">سعر التقسيط</span>
          <Price value={product.installmentPrice} />
        </div>
      </div>

      {product.description ? (
        <section className="block surface">
          <h3>وصف الجهاز</h3>
          <p className="pre">{product.description}</p>
        </section>
      ) : null}
      {product.specs ? (
        <section className="block surface">
          <h3>المواصفات</h3>
          <p className="pre">{product.specs}</p>
        </section>
      ) : null}

      <p className="meta">
        أُضيف في {formatDate(product.createdAt)}
        {product.updatedAt !== product.createdAt ? ` · آخر تعديل ${formatDate(product.updatedAt)}` : ''}
      </p>

      <ConfirmSheet
        open={confirm}
        title="حذف الجهاز؟"
        danger
        busy={busy}
        confirmLabel="حذف"
        message={
          <>
            سيتم حذف <strong>«{product.name}»</strong> نهائيًا مع صورته. لا يمكن التراجع عن هذا الإجراء.
          </>
        }
        onConfirm={onDelete}
        onCancel={() => setConfirm(false)}
      />
    </Overlay>
  );
}
