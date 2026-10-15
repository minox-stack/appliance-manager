import { BackupError } from './errors.ts';

export const BACKUP_APP = 'appliance-manager';
export const BACKUP_SCHEMA = 1;

export interface BackupImage {
  type: string;
  /** base64 للصورة الكاملة */
  data: string;
  /** base64 للمصغّرة (اختياري) */
  thumb?: string;
}

export interface BackupCategory {
  id: string;
  name: string;
  order: number;
}

export interface BackupProduct {
  id: string;
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  cashPrice: number;
  installmentPrice: number;
  description: string;
  specs: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  image: BackupImage | null;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  createdAt: string;
  categories: BackupCategory[];
  products: BackupProduct[];
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x4000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  return base64ToBytes(b64).buffer as ArrayBuffer;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

function validB64(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length % 4 === 0 && B64.test(s);
}

function optStr(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  return typeof v === 'string' ? v : '';
}

function price(o: Record<string, unknown>, k: string, where: string): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new BackupError(`${where}: السعر غير صالح.`);
  if (v < 0) throw new BackupError(`${where}: السعر لا يمكن أن يكون سالبًا.`);
  return v;
}

/** يقرأ ملف نسخة احتياطية ويتحقق من بنيته بالكامل. يرمي BackupError برسالة عربية. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('الملف تالف أو ليس ملف JSON صحيحًا.');
  }
  if (!isObj(raw)) throw new BackupError('بنية الملف غير صحيحة.');
  if (raw.app !== BACKUP_APP) throw new BackupError('هذا الملف ليس نسخة احتياطية لهذا التطبيق.');

  const ver = raw.schemaVersion;
  if (typeof ver !== 'number' || !Number.isInteger(ver) || ver < 1) {
    throw new BackupError('رقم إصدار النسخة الاحتياطية غير صالح.');
  }
  if (ver > BACKUP_SCHEMA) {
    throw new BackupError('هذه النسخة أُنشئت بإصدار أحدث من التطبيق. حدّث التطبيق ثم أعد المحاولة.');
  }
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.products)) {
    throw new BackupError('الملف لا يحتوي على قوائم التصنيفات والأجهزة.');
  }

  const categories: BackupCategory[] = [];
  const catIds = new Set<string>();
  raw.categories.forEach((c, i) => {
    const where = `التصنيف رقم ${i + 1}`;
    if (!isObj(c)) throw new BackupError(`${where}: بنية غير صحيحة.`);
    if (typeof c.id !== 'string' || !c.id) throw new BackupError(`${where}: المعرّف مفقود.`);
    if (typeof c.name !== 'string' || !c.name.trim()) throw new BackupError(`${where}: الاسم مفقود.`);
    if (catIds.has(c.id)) throw new BackupError(`${where}: معرّف مكرر.`);
    catIds.add(c.id);
    categories.push({ id: c.id, name: c.name.trim(), order: typeof c.order === 'number' ? c.order : i + 1 });
  });

  const products: BackupProduct[] = [];
  const ids = new Set<string>();
  raw.products.forEach((p, i) => {
    const where = `الجهاز رقم ${i + 1}`;
    if (!isObj(p)) throw new BackupError(`${where}: بنية غير صحيحة.`);
    if (typeof p.id !== 'string' || !p.id) throw new BackupError(`${where}: المعرّف مفقود.`);
    if (ids.has(p.id)) throw new BackupError(`${where}: معرّف مكرر.`);
    ids.add(p.id);
    if (typeof p.name !== 'string' || !p.name.trim()) throw new BackupError(`${where}: اسم الجهاز مفقود.`);
    if (typeof p.categoryId !== 'string') throw new BackupError(`${where}: التصنيف مفقود.`);
    const cashPrice = price(p, 'cashPrice', where);
    const installmentPrice = price(p, 'installmentPrice', where);
    const now = Date.now();
    const createdAt = typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) ? p.createdAt : now;
    const updatedAt = typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) ? p.updatedAt : createdAt;

    let image: BackupImage | null = null;
    if (p.image !== null && p.image !== undefined) {
      const im = p.image;
      if (!isObj(im)) throw new BackupError(`${where}: بيانات الصورة غير صحيحة.`);
      if (typeof im.type !== 'string' || !im.type.startsWith('image/')) {
        throw new BackupError(`${where}: نوع الصورة غير صالح.`);
      }
      if (!validB64(im.data)) throw new BackupError(`${where}: بيانات الصورة تالفة.`);
      if (im.thumb !== undefined && !validB64(im.thumb)) throw new BackupError(`${where}: المصغّرة تالفة.`);
      image = { type: im.type, data: im.data, thumb: im.thumb as string | undefined };
    }

    products.push({
      id: p.id,
      name: p.name.trim(),
      brand: optStr(p, 'brand'),
      model: optStr(p, 'model'),
      categoryId: p.categoryId,
      cashPrice,
      installmentPrice,
      description: optStr(p, 'description'),
      specs: optStr(p, 'specs'),
      favorite: p.favorite === true,
      createdAt,
      updatedAt,
      image,
    });
  });

  return {
    app: BACKUP_APP,
    schemaVersion: ver,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    categories,
    products,
  };
}
