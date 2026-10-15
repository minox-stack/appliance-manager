export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  cashPrice: number;
  installmentPrice: number;
  description: string;
  specs: string;
  /** 0/1 بدل boolean لأن IndexedDB لا تفهرس القيم المنطقية */
  favorite: 0 | 1;
  hasImage: 0 | 1;
  createdAt: number;
  updatedAt: number;
}

export interface ProductImage {
  productId: string;
  type: string;
  /** الصورة الكاملة (JPEG مضغوط) */
  data: ArrayBuffer;
  /** مصغّرة للبطاقات */
  thumb: ArrayBuffer;
}

export type SortKey = 'newest' | 'name' | 'cashAsc' | 'cashDesc' | 'instAsc' | 'instDesc';

export const OTHER_CATEGORY_ID = 'other';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-fridges', name: 'ثلاجات', order: 1 },
  { id: 'cat-washers', name: 'غسالات', order: 2 },
  { id: 'cat-tvs', name: 'تلفزيونات', order: 3 },
  { id: 'cat-ac', name: 'مكيفات', order: 4 },
  { id: 'cat-ovens', name: 'أفران وطباخات', order: 5 },
  { id: 'cat-freezers', name: 'مجمدات', order: 6 },
  { id: 'cat-small', name: 'أجهزة صغيرة', order: 7 },
  { id: OTHER_CATEGORY_ID, name: 'أخرى', order: 8 },
];

export const MAX_PRICE = 999_999_999;
