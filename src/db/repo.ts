import { db } from './database.ts';
import { DEFAULT_CATEGORIES, MAX_PRICE, OTHER_CATEGORY_ID } from '../types.ts';
import type { Category, Product } from '../types.ts';
import { AppError } from '../lib/errors.ts';
import { uid } from '../lib/id.ts';
import { normalizeText } from '../lib/search.ts';

export interface ProductInput {
  id?: string;
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  cashPrice: number;
  installmentPrice: number;
  description: string;
  specs: string;
}

export type ImageChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'set'; type: string; data: ArrayBuffer; thumb: ArrayBuffer };

export async function loadAll(): Promise<{ products: Product[]; categories: Category[] }> {
  const [products, categories] = await Promise.all([db.products.toArray(), db.categories.orderBy('order').toArray()]);
  return { products, categories };
}

function checkPrice(v: number, label: string) {
  if (!Number.isFinite(v) || v < 0) throw new AppError(`${label} غير صالح.`);
  if (v > MAX_PRICE) throw new AppError(`${label} كبير جدًا.`);
}

export async function saveProduct(input: ProductInput, change: ImageChange): Promise<Product> {
  const name = input.name.trim();
  if (!name) throw new AppError('اسم الجهاز مطلوب.');
  checkPrice(input.cashPrice, 'سعر الكاش');
  checkPrice(input.installmentPrice, 'سعر التقسيط');
  const now = Date.now();

  return db.transaction('rw', db.products, db.images, db.categories, async () => {
    if (!(await db.categories.get(input.categoryId))) throw new AppError('التصنيف المختار لم يعد موجودًا.');
    const existing = input.id ? await db.products.get(input.id) : undefined;
    if (input.id && !existing) throw new AppError('هذا الجهاز لم يعد موجودًا.');

    const hasImage: 0 | 1 = change.kind === 'set' ? 1 : change.kind === 'remove' ? 0 : (existing?.hasImage ?? 0);
    const product: Product = {
      id: existing?.id ?? uid(),
      name,
      brand: input.brand.trim(),
      model: input.model.trim(),
      categoryId: input.categoryId,
      cashPrice: input.cashPrice,
      installmentPrice: input.installmentPrice,
      description: input.description.trim(),
      specs: input.specs.trim(),
      favorite: existing?.favorite ?? 0,
      hasImage,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.products.put(product);
    if (change.kind === 'set') {
      await db.images.put({ productId: product.id, type: change.type, data: change.data, thumb: change.thumb });
    } else if (change.kind === 'remove') {
      await db.images.delete(product.id);
    }
    return product;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await db.transaction('rw', db.products, db.images, async () => {
    await db.products.delete(id);
    await db.images.delete(id);
  });
}

export async function setFavorite(id: string, value: 0 | 1): Promise<void> {
  const n = await db.products.update(id, { favorite: value });
  if (n === 0) throw new AppError('هذا الجهاز لم يعد موجودًا.');
}

export async function getImageBlob(productId: string, which: 'full' | 'thumb'): Promise<Blob | null> {
  const rec = await db.images.get(productId);
  if (!rec) return null;
  return new Blob([which === 'thumb' ? rec.thumb : rec.data], { type: rec.type });
}

/* ---------- التصنيفات ---------- */

function cleanCategoryName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new AppError('اكتب اسم التصنيف.');
  if (name.length > 40) throw new AppError('اسم التصنيف طويل (40 حرفًا كحد أقصى).');
  return name;
}

async function assertUniqueCategory(name: string, exceptId?: string) {
  const key = normalizeText(name);
  const all = await db.categories.toArray();
  if (all.some((c) => c.id !== exceptId && normalizeText(c.name) === key)) {
    throw new AppError('يوجد تصنيف بهذا الاسم مسبقًا.');
  }
}

export async function addCategory(rawName: string): Promise<Category> {
  const name = cleanCategoryName(rawName);
  return db.transaction('rw', db.categories, async () => {
    await assertUniqueCategory(name);
    const all = await db.categories.toArray();
    const order = all.reduce((m, c) => Math.max(m, c.order), 0) + 1;
    const cat: Category = { id: uid(), name, order };
    await db.categories.add(cat);
    return cat;
  });
}

export async function renameCategory(id: string, rawName: string): Promise<void> {
  const name = cleanCategoryName(rawName);
  await db.transaction('rw', db.categories, async () => {
    await assertUniqueCategory(name, id);
    const n = await db.categories.update(id, { name });
    if (n === 0) throw new AppError('هذا التصنيف لم يعد موجودًا.');
  });
}

/** يحذف تصنيفًا بعد نقل أجهزته إلى تصنيف آخر. يعيد عدد الأجهزة المنقولة. */
export async function deleteCategory(id: string, moveToId: string): Promise<number> {
  if (id === OTHER_CATEGORY_ID) throw new AppError('لا يمكن حذف تصنيف «أخرى».');
  if (id === moveToId) throw new AppError('اختر تصنيفًا مختلفًا لنقل الأجهزة إليه.');
  return db.transaction('rw', db.products, db.categories, async () => {
    if (!(await db.categories.get(moveToId))) throw new AppError('التصنيف الجديد غير موجود.');
    const moved = await db.products.where('categoryId').equals(id).modify({ categoryId: moveToId });
    await db.categories.delete(id);
    return moved;
  });
}

/** يمسح كل شيء ثم يعيد التصنيفات الافتراضية. */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.products, db.categories, db.images, async () => {
    await db.products.clear();
    await db.images.clear();
    await db.categories.clear();
    await db.categories.bulkAdd(DEFAULT_CATEGORIES.map((c) => ({ ...c })));
  });
}
