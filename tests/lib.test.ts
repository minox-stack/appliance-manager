import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, buildHaystack, parseQuery, matches, applyFilters } from '../src/lib/search.ts';
import type { Haystack } from '../src/lib/search.ts';
import { parsePrice, formatPrice } from '../src/lib/format.ts';
import { parseBackup, bytesToBase64, base64ToBytes, BACKUP_APP, BACKUP_SCHEMA } from '../src/lib/backupFormat.ts';
import { buildCsv } from '../src/lib/csv.ts';
import { BackupError } from '../src/lib/errors.ts';
import type { Product } from '../src/types.ts';
import { DEFAULT_CATEGORIES } from '../src/types.ts';

function mk(p: Partial<Product>): Product {
  return {
    id: 'x',
    name: 'منتج',
    brand: '',
    model: '',
    categoryId: 'other',
    cashPrice: 1,
    installmentPrice: 2,
    description: '',
    specs: '',
    favorite: 0,
    hasImage: 0,
    createdAt: 1,
    updatedAt: 1,
    ...p,
  };
}

function hayFor(list: Product[]): Map<string, Haystack> {
  const names = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));
  return new Map(list.map((p) => [p.id, buildHaystack(p, names.get(p.categoryId) ?? '')]));
}

test('normalizeText: عربي ولاتيني', () => {
  assert.equal(normalizeText('  أَحمد  إلى  '), 'احمد الي');
  assert.equal(normalizeText('ثلاجة'), 'ثلاجه');
  assert.equal(normalizeText('مُؤَسَّسَة'), 'موسسه');
  assert.equal(normalizeText('RéFrigérateur'), 'refrigerateur');
  assert.equal(normalizeText('٨٥٠٠٠'), '85000');
});

test('البحث: الاسم، الماركة، الموديل، التصنيف، الوصف، المواصفات', () => {
  const list = [
    mk({ id: '1', name: 'ثلاجة كوندور', brand: 'Condor', model: 'RS-25 X', categoryId: 'cat-fridges', description: 'نوفروست', specs: '450 لتر' }),
    mk({ id: '2', name: 'Samsung TV', brand: 'Samsung', model: 'UA55', categoryId: 'cat-tvs' }),
  ];
  const hay = hayFor(list);
  const run = (query: string) =>
    applyFilters(list, hay, { query, categoryId: 'all', favOnly: false, sort: 'newest' }).map((p) => p.id);
  assert.deepEqual(run('condor'), ['1']); // ماركة لاتينية
  assert.deepEqual(run('كوندور'), ['1']); // اسم عربي
  assert.deepEqual(run('rs25'), ['1']); // موديل بلا شرطة
  assert.deepEqual(run('RS 25'), ['1']);
  assert.deepEqual(run('الثلاجات'), ['1']); // جمع + ال التعريف ← تصنيف
  assert.deepEqual(run('ثلاجه'), ['1']); // ة/ه
  assert.deepEqual(run('نوفروست'), ['1']); // وصف
  assert.deepEqual(run('450 لتر'), ['1']); // مواصفات
  assert.deepEqual(run('سامسونج'), ['2']); // مرادف ماركة
  assert.deepEqual(run('samsung ua55'), ['2']); // عدة كلمات
  assert.deepEqual(run('تلفزيونات'), ['2']);
  assert.deepEqual(run('غير موجود'), []);
  assert.deepEqual(run('').sort(), ['1', '2']);
});

test('الفلاتر والترتيب', () => {
  const list = [
    mk({ id: 'a', name: 'ب', categoryId: 'cat-tvs', cashPrice: 300, installmentPrice: 100, favorite: 1, createdAt: 1 }),
    mk({ id: 'b', name: 'أ', categoryId: 'cat-tvs', cashPrice: 100, installmentPrice: 300, createdAt: 2 }),
    mk({ id: 'c', name: 'ج', categoryId: 'cat-ac', cashPrice: 200, installmentPrice: 200, createdAt: 3 }),
  ];
  const hay = hayFor(list);
  const f = (o: object) =>
    applyFilters(list, hay, { query: '', categoryId: 'all', favOnly: false, sort: 'newest', ...o }).map((p) => p.id);
  assert.deepEqual(f({}), ['c', 'b', 'a']);
  assert.deepEqual(f({ sort: 'name' }), ['b', 'a', 'c']);
  assert.deepEqual(f({ sort: 'cashAsc' }), ['b', 'c', 'a']);
  assert.deepEqual(f({ sort: 'cashDesc' }), ['a', 'c', 'b']);
  assert.deepEqual(f({ sort: 'instAsc' }), ['a', 'c', 'b']);
  assert.deepEqual(f({ categoryId: 'cat-tvs' }), ['b', 'a']);
  assert.deepEqual(f({ favOnly: true }), ['a']);
  assert.deepEqual(f({ categoryId: 'cat-ac', favOnly: true }), []);
});

test('parsePrice / formatPrice', () => {
  assert.equal(parsePrice('85000'), 85000);
  assert.equal(parsePrice('85,000'), 85000);
  assert.equal(parsePrice('٨٥٠٠٠'), 85000);
  assert.equal(parsePrice('-5'), null);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice('12a'), null);
  assert.equal(formatPrice(85000), '85,000 دج');
  assert.equal(formatPrice(105000), '105,000 دج');
});

function sampleBackup(): string {
  const bytes = new Uint8Array(200_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 256;
  return JSON.stringify({
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA,
    createdAt: new Date().toISOString(),
    categories: [{ id: 'other', name: 'أخرى', order: 1 }],
    products: [
      {
        id: 'p1', name: 'ثلاجة', brand: 'Condor', model: 'X1', categoryId: 'other',
        cashPrice: 85000, installmentPrice: 105000, description: 'د', specs: 'م', favorite: true,
        createdAt: 1, updatedAt: 2,
        image: { type: 'image/jpeg', data: bytesToBase64(bytes), thumb: bytesToBase64(bytes.subarray(0, 1000)) },
      },
    ],
  });
}

test('النسخة الاحتياطية: ذهاب وإياب للصور (base64) دون أي فقدان', () => {
  const bytes = new Uint8Array(200_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + 7) % 256;
  const back = base64ToBytes(bytesToBase64(bytes));
  assert.equal(back.length, bytes.length);
  assert.ok(back.every((v, i) => v === bytes[i]));

  const parsed = parseBackup(sampleBackup());
  assert.equal(parsed.products.length, 1);
  assert.equal(parsed.products[0].favorite, true);
  const img = parsed.products[0].image!;
  assert.ok(base64ToBytes(img.data).every((v, i) => v === bytes[i]));
});

test('النسخة الاحتياطية: رفض الملفات غير الصالحة', () => {
  const good = JSON.parse(sampleBackup());
  const bad = (mutate: (o: any) => void) => {
    const o = structuredClone(good);
    mutate(o);
    assert.throws(() => parseBackup(JSON.stringify(o)), BackupError);
  };
  assert.throws(() => parseBackup('{ not json'), BackupError);
  assert.throws(() => parseBackup('[]'), BackupError);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'other' })), BackupError);
  bad((o) => (o.schemaVersion = 99));
  bad((o) => (o.schemaVersion = 'x'));
  bad((o) => (o.products[0].cashPrice = -1));
  bad((o) => (o.products[0].installmentPrice = 'abc'));
  bad((o) => (o.products[0].name = ''));
  bad((o) => (o.products[0].image.data = 'not base64!!'));
  bad((o) => (o.products[0].image.type = 'text/html'));
  bad((o) => o.products.push(o.products[0])); // معرّف مكرر
  bad((o) => (o.categories = null));
});

test('CSV: ترميز، علامات اقتباس، وحماية الصيغ', () => {
  const csv = buildCsv(
    [mk({ id: '1', name: 'اسم "مقتبس"', brand: '=HYPERLINK()', cashPrice: 85000, installmentPrice: 105000, description: 'سطر1\nسطر2' })],
    DEFAULT_CATEGORIES,
  );
  assert.ok(csv.startsWith('"اسم الجهاز"'));
  assert.ok(csv.includes('"اسم ""مقتبس"""'));
  assert.ok(csv.includes(`"'=HYPERLINK()"`));
  assert.ok(csv.includes('"85000","105000"'));
  assert.ok(csv.includes('"سطر1\nسطر2"'));
});

test('parseQuery يتجاهل الاستعلام الفارغ', () => {
  assert.deepEqual(parseQuery('   '), []);
  assert.ok(matches({ text: 'abc', compact: 'abc' }, []));
});
