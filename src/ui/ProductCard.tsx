import { memo } from 'react';
import type { Product } from '../types.ts';
import { Icon } from './Icon.tsx';
import { Price } from './Price.tsx';
import { ProductImage } from './ProductImage.tsx';

interface Props {
  product: Product;
  categoryName: string;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleFav: (id: string) => void;
}

function FavButton({ product, onToggleFav }: { product: Product; onToggleFav: (id: string) => void }) {
  const on = product.favorite === 1;
  return (
    <button
      type="button"
      className={`icon-btn fav ${on ? 'fav-on' : ''}`}
      aria-pressed={on}
      aria-label={on ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
      onClick={() => onToggleFav(product.id)}
    >
      <Icon name="heart" filled={on} />
    </button>
  );
}

/** بطاقة كاملة (صفحة المنتجات). */
export const ProductCard = memo(function ProductCard({ product, categoryName, onOpen, onEdit, onToggleFav }: Props) {
  const sub = [product.brand, product.model].filter(Boolean).join(' · ');
  return (
    <article className="card surface">
      <div
        className="card-main pressable"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(product.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(product.id);
          }
        }}
      >
        <div className="card-top">
          <ProductImage product={product} />
          <div className="card-info">
            <h3 className="card-name">{product.name}</h3>
            <p className="card-sub">{sub ? <bdi>{sub}</bdi> : '—'}</p>
            <span className="chip chip-static">{categoryName}</span>
          </div>
        </div>
        <div className="prices">
          <div className="pbox cash">
            <span className="plabel">سعر الكاش</span>
            <Price value={product.cashPrice} />
          </div>
          <div className="pbox inst">
            <span className="plabel">سعر التقسيط</span>
            <Price value={product.installmentPrice} />
          </div>
        </div>
      </div>
      <div className="card-fav">
        <FavButton product={product} onToggleFav={onToggleFav} />
      </div>
      <div className="card-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(product.id)}>
          <Icon name="eye" size={18} /> عرض
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(product.id)}>
          <Icon name="pencil" size={18} /> تعديل
        </button>
      </div>
    </article>
  );
});

/** صف مضغوط للبحث السريع في الصفحة الرئيسية. */
export const ProductRow = memo(function ProductRow({
  product,
  onOpen,
  onToggleFav,
}: Omit<Props, 'categoryName' | 'onEdit'>) {
  const sub = [product.brand, product.model].filter(Boolean).join(' · ');
  return (
    <article className="row surface">
      <div
        className="row-main pressable"
        role="button"
        tabIndex={0}
        onClick={() => onOpen(product.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(product.id);
          }
        }}
      >
        <ProductImage product={product} className="pimg-sm" />
        <div className="row-info">
          <h3 className="card-name">{product.name}</h3>
          {sub ? (
            <p className="card-sub">
              <bdi>{sub}</bdi>
            </p>
          ) : null}
          <div className="row-prices">
            <span className="mini cash">
              <em>كاش</em> <Price value={product.cashPrice} />
            </span>
            <span className="mini inst">
              <em>تقسيط</em> <Price value={product.installmentPrice} />
            </span>
          </div>
        </div>
      </div>
      <FavButton product={product} onToggleFav={onToggleFav} />
    </article>
  );
});
