import { db } from './database.ts';
import { DEFAULT_CATEGORIES, OTHER_CATEGORY_ID } from '../types.ts';
import type { Category, Product, ProductImage } from '../types.ts';
import { BACKUP_APP, BACKUP_SCHEMA, base64ToBuffer, bytesToBase64 } from '../lib/backupFormat.ts';
import type { BackupFile, BackupProduct } from '../lib/backupFormat.ts';
import { normalizeText } from '../lib/search.ts';
import { todayStamp } from '../lib/format.ts';

/** يبني كائن النسخة الاحتياطية من القاعدة (مع الصور مشفّرة base64). */
export async function buildBackup(): Promise<BackupFile> {
  const { cats, prods, imgs } = await db.transaction('r', db.categories, db.products, db.images, async () => ({
    cats: await db.categories.orderBy('order').toArray(),
    prods: await db.products.toArray(),
    imgs: await db.images.toArray(),
  }));
  const imgMap = new Map(imgs.map((i) => [i.productId, i]));
  const products: BackupProduct[] = prods.map((p) => {
    const im = imgMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      model: p.model,
      categoryId: p.categoryId,
      cashPrice: p.cashPrice,
      installmentPrice: p.installmentPrice,
      description: p.description,
      specs: p.specs,
      favorite: p.favorite === 1,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      image: im
        ? { type: im.type, data: bytesToBase64(new Uint8Array(im.data)), thumb: bytesToBase64(new Uint8Array(im.thumb)) }
        : null,
    };
  });
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA,
    createdAt: new Date().toISOString(),
    categories: cats.map((c) => ({ id: c.id, name: c.name, order: c.order })),
    products,
  };
}

export async function makeBackupFile(): Promise<File> {
  const backup = await buildBackup();
  return new File([JSON.stringify(backup)], `appliances-backup-${todayStamp()}.json`, { type: 'application/json' });
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  categoriesAdded: number;
}

/**
 * يستعيد نسخة احتياطية داخل معاملة واحدة (إما أن ينجح كل شيء أو لا يتغير شيء).
 *  - replace: يستبدل كل البيانات الحالية.
 *  - merge:   يضيف الجديد؛ وإن وُجد جهاز بنفس المعرّف يُحتفظ بالأحدث (حسب وقت التعديل).
 */
export async function importBackup(file: BackupFile, mode: 'replace' | 'merge'): Promise<ImportResult> {
  // فك ترميز الصور قبل فتح المعاملة (لا يجوز استخدام await غير Dexie داخلها).
  const decoded = new Map<string, ProductImage>();
  for (const p of file.products) {
    if (!p.image) continue;
    const data = base64ToBuffer(p.image.data);
    const thumb = p.image.thumb ? base64ToBuffer(p.image.thumb) : data;
    decoded.set(p.id, { productId: p.id, type: p.image.type, data, thumb });
  }

  const toProduct = (p: BackupProduct, categoryId: string): Product => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    model: p.model,
    categoryId,
    cashPrice: p.cashPrice,
    installmentPrice: p.installmentPrice,
    description: p.description,
    specs: p.specs,
    favorite: p.favorite ? 1 : 0,
    hasImage: decoded.has(p.id) ? 1 : 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });

  return db.transaction('rw', db.products, db.categories, db.images, async () => {
    const result: ImportResult = { added: 0, updated: 0, skipped: 0, categoriesAdded: 0 };

    if (mode === 'replace') {
      const cats: Category[] = file.categories.map((c) => ({ ...c }));
      if (!cats.some((c) => c.id === OTHER_CATEGORY_ID)) {
        const fallback = DEFAULT_CATEGORIES.find((c) => c.id === OTHER_CATEGORY_ID)!;
        cats.push({ ...fallback, order: cats.reduce((m, c) => Math.max(m, c.order), 0) + 1 });
      }
      const known = new Set(cats.map((c) => c.id));
      await db.products.clear();
      await db.images.clear();
      await db.categories.clear();
      await db.categories.bulkAdd(cats);
      await db.products.bulkAdd(file.products.map((p) => toProduct(p, known.has(p.categoryId) ? p.categoryId : OTHER_CATEGORY_ID)));
      await db.images.bulkAdd([...decoded.values()]);
      result.added = file.products.length;
      result.categoriesAdded = cats.length;
      return result;
    }

    // ---- دمج ----
    const existingCats = await db.categories.toArray();
    const byId = new Map(existingCats.map((c) => [c.id, c]));
    const byName = new Map(existingCats.map((c) => [normalizeText(c.name), c]));
    const catMap = new Map<string, string>();
    let order = existingCats.reduce((m, c) => Math.max(m, c.order), 0);
    for (const c of file.categories) {
      const same = byId.get(c.id) ?? byName.get(normalizeText(c.name));
      if (same) {
        catMap.set(c.id, same.id);
      } else {
        order += 1;
        const added: Category = { id: c.id, name: c.name, order };
        await db.categories.add(added);
        byId.set(added.id, added);
        byName.set(normalizeText(added.name), added);
        catMap.set(c.id, added.id);
        result.categoriesAdded += 1;
      }
    }

    const current = await db.products.bulkGet(file.products.map((p) => p.id));
    for (let i = 0; i < file.products.length; i++) {
      const p = file.products[i];
      const cur = current[i];
      const categoryId = catMap.get(p.categoryId) ?? OTHER_CATEGORY_ID;
      if (!cur) {
        await db.products.add(toProduct(p, categoryId));
        const img = decoded.get(p.id);
        if (img) await db.images.put(img);
        result.added += 1;
      } else if (p.updatedAt > cur.updatedAt) {
        await db.products.put(toProduct(p, categoryId));
        const img = decoded.get(p.id);
        if (img) await db.images.put(img);
        else await db.images.delete(p.id);
        result.updated += 1;
      } else {
        result.skipped += 1;
      }
    }
    return result;
  });
}
