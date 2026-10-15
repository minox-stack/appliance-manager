import { useEffect, useRef, useState } from 'react';
import type { Product } from '../types.ts';
import { getImageBlob } from '../db/repo.ts';
import { Icon } from './Icon.tsx';

/** مصغّرات صغيرة (≈15KB) نحتفظ بروابطها طوال الجلسة. */
const thumbCache = new Map<string, string>();

interface Props {
  product: Product;
  /** الصورة الكاملة (صفحة التفاصيل) بدل المصغّرة */
  full?: boolean;
  className?: string;
}

export function ProductImage({ product, full = false, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const key = `${product.id}:${product.updatedAt}`;

  // تحميل الصورة فقط عندما تقترب البطاقة من الشاشة
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!product.hasImage || !visible) {
      setUrl(null);
      return;
    }
    if (!full) {
      const cached = thumbCache.get(key);
      if (cached) {
        setUrl(cached);
        return;
      }
    }
    let cancelled = false;
    let created: string | null = null;
    getImageBlob(product.id, full ? 'full' : 'thumb')
      .then((blob) => {
        if (cancelled || !blob) return;
        const u = URL.createObjectURL(blob);
        if (full) created = u;
        else thumbCache.set(key, u);
        setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [product.id, product.hasImage, key, full, visible]);

  return (
    <div ref={ref} className={`pimg ${full ? 'pimg-full' : ''} ${className}`}>
      {url ? (
        <img src={url} alt={product.name} decoding="async" draggable={false} />
      ) : (
        <div className="pimg-ph" aria-hidden="true">
          <Icon name="fridge" size={full ? 56 : 30} />
        </div>
      )}
    </div>
  );
}
