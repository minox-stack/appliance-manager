const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatNumber(n: number): string {
  return nf.format(Math.round(n));
}

/** 85000 → "85,000 دج" */
export function formatPrice(n: number): string {
  return `${formatNumber(n)} دج`;
}

/** يحوّل الأرقام العربية الهندية والفارسية إلى لاتينية. */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * يقرأ سعرًا من نص: أرقام فقط (تُتجاهل الفواصل والمسافات).
 * يعيد null إن كان النص غير صالح (فارغ، سالب، أو فيه رموز أخرى).
 */
export function parsePrice(input: string): number | null {
  const cleaned = toLatinDigits(input).replace(/[\s,.٫٬،]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat('ar-DZ-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(ts),
    );
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} ك.ب`;
  return `${(n / (1024 * 1024)).toFixed(1)} م.ب`;
}

export function todayStamp(d = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
