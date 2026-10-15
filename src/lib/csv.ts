import type { Category, Product } from '../types.ts';

function cell(v: string): string {
  // حماية من حقن الصيغ في Excel: الخلايا التي تبدأ بـ = + - @ تُسبق بفاصلة عليا.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCsv(products: Product[], categories: Category[]): string {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const header = ['اسم الجهاز', 'الماركة', 'الموديل', 'التصنيف', 'سعر الكاش (دج)', 'سعر التقسيط (دج)', 'الوصف'];
  const rows = [...products]
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .map((p) => [
      p.name,
      p.brand,
      p.model,
      names.get(p.categoryId) ?? '',
      String(p.cashPrice),
      String(p.installmentPrice),
      p.description,
    ]);
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
