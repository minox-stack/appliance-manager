import type { Product, SortKey } from '../types.ts';
import { toLatinDigits } from './format.ts';

const MARKS = /[̀-ًͯ-ٰٟـ]/g;

/**
 * تطبيع النص للبحث:
 * - أرقام لاتينية، أحرف صغيرة، حذف التشكيل والتطويل والتشكيلات اللاتينية (é → e)
 * - توحيد: أإآٱ → ا ، ى → ي ، ة → ه ، ؤ → و ، ئ → ي
 */
export function normalizeText(input: string): string {
  return toLatinDigits(input)
    .normalize('NFKD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** نسخة بلا فواصل ولا رموز: "RS-25 X" → "rs25x" حتى يطابق بحث "rs25". */
export function compactText(normalized: string): string {
  return normalized.replace(/[^\p{L}\p{N}]+/gu, '');
}

/** مجموعات مرادفات (لاتيني ↔ عربي) لأشهر الماركات، لتعمل الكتابة بأي حرف. */
const ALIAS_GROUPS: string[][] = [
  ['condor', 'كوندور'],
  ['samsung', 'سامسونج', 'سامسونغ'],
  ['lg', 'ال جي', 'الجي'],
  ['brandt', 'براندت'],
  ['iris', 'ايريس', 'ايرس'],
  ['beko', 'بيكو'],
  ['cristor', 'كريستور'],
  ['starlight', 'ستارلايت'],
  ['haier', 'هاير'],
  ['sony', 'سوني'],
  ['hisense', 'هايسنس'],
  ['toshiba', 'توشيبا'],
  ['whirlpool', 'ويرلبول'],
  ['bosch', 'بوش'],
  ['siemens', 'سيمنز'],
  ['panasonic', 'باناسونيك'],
  ['midea', 'ميديا'],
  ['hitachi', 'هيتاشي'],
  ['philips', 'فيليبس'],
];
const GROUPS = ALIAS_GROUPS.map((g) => g.map(normalizeText));

function aliasesFor(text: string): string {
  const words = new Set(text.split(' '));
  const extra: string[] = [];
  for (const g of GROUPS) {
    if (g.some((m) => (m.includes(' ') ? text.includes(m) : words.has(m)))) extra.push(...g);
  }
  return extra.join(' ');
}

export interface Haystack {
  text: string;
  compact: string;
}

export function buildHaystack(p: Product, categoryName: string): Haystack {
  const base = normalizeText([p.name, p.brand, p.model, categoryName, p.description, p.specs].join(' '));
  const text = `${base} ${aliasesFor(base)}`;
  return { text, compact: compactText(text) };
}

export interface QueryToken {
  vars: string[];
  c: string;
}

/** صيغ بسيطة للمفرد/الجمع و"ال" التعريف: الثلاجات ← ثلاجات ← ثلاج */
function variants(t: string): string[] {
  const out = new Set<string>([t]);
  const bases = [t];
  if (t.startsWith('ال') && t.length > 4) {
    const b = t.slice(2);
    out.add(b);
    bases.push(b);
  }
  for (const b of bases) {
    if (b.endsWith('ات') && b.length >= 5) out.add(b.slice(0, -2));
    else if (b.endsWith('ه') && b.length >= 4) out.add(b.slice(0, -1));
  }
  return [...out];
}

export function parseQuery(q: string): QueryToken[] {
  const n = normalizeText(q);
  if (!n) return [];
  return n.split(' ').map((t) => ({ vars: variants(t), c: compactText(t) }));
}

export function matches(h: Haystack, tokens: QueryToken[]): boolean {
  return tokens.every((k) => k.vars.some((v) => h.text.includes(v)) || (k.c.length > 0 && h.compact.includes(k.c)));
}

export interface Filters {
  query: string;
  categoryId: string; // 'all' أو معرّف تصنيف
  favOnly: boolean;
  sort: SortKey;
}

export function sortProducts(list: Product[], key: SortKey): Product[] {
  const out = [...list];
  switch (key) {
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    case 'cashAsc':
      return out.sort((a, b) => a.cashPrice - b.cashPrice);
    case 'cashDesc':
      return out.sort((a, b) => b.cashPrice - a.cashPrice);
    case 'instAsc':
      return out.sort((a, b) => a.installmentPrice - b.installmentPrice);
    case 'instDesc':
      return out.sort((a, b) => b.installmentPrice - a.installmentPrice);
    default:
      return out.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export function applyFilters(products: Product[], hay: Map<string, Haystack>, f: Filters): Product[] {
  const tokens = parseQuery(f.query);
  const out = products.filter((p) => {
    if (f.categoryId !== 'all' && p.categoryId !== f.categoryId) return false;
    if (f.favOnly && p.favorite !== 1) return false;
    if (tokens.length === 0) return true;
    const h = hay.get(p.id);
    return h ? matches(h, tokens) : false;
  });
  return sortProducts(out, f.sort);
}
