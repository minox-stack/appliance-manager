import Dexie from 'dexie';
import type { Table } from 'dexie';
import { DEFAULT_CATEGORIES } from '../types.ts';
import type { Category, Product, ProductImage } from '../types.ts';

/**
 * قاعدة البيانات المحلية (IndexedDB عبر Dexie).
 *
 * الإصدارات (migrations):
 *  - v1: products, categories, images
 *
 * لإضافة تغيير في المستقبل: أضف this.version(2).stores({...}).upgrade(tx => {...})
 * ولا تعدّل version(1). Dexie يشغّل الترقية تلقائيًا عند أول فتح بالكود الجديد.
 */
export class ApplianceDB extends Dexie {
  declare products: Table<Product, string>;
  declare categories: Table<Category, string>;
  declare images: Table<ProductImage, string>;

  constructor() {
    super('appliance-manager');
    this.version(1).stores({
      products: 'id, categoryId, favorite, createdAt, updatedAt',
      categories: 'id, order',
      images: 'productId',
    });
    // يُنفَّذ مرة واحدة فقط عند إنشاء القاعدة لأول مرة.
    this.on('populate', (tx) => {
      return tx.table('categories').bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    });
  }
}

export const db = new ApplianceDB();
