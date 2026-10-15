import { formatNumber } from '../lib/format.ts';

/** 85000 → "85,000 دج" (الرقم لاتيني ومعزول اتجاهيًا حتى لا تنقلب الفواصل). */
export function Price({ value }: { value: number }) {
  return (
    <span className="price">
      <bdi className="num">{formatNumber(value)}</bdi> <span className="cur">دج</span>
    </span>
  );
}
