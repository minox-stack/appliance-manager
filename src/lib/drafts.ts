/** مسودة نموذج الجهاز (نصوص فقط، بدون الصورة) حتى لا تضيع إن خرجت من الصفحة مؤقتًا. */
export interface DraftForm {
  name: string;
  brand: string;
  model: string;
  categoryId: string;
  cash: string;
  inst: string;
  description: string;
  specs: string;
}

const KEYS: (keyof DraftForm)[] = ['name', 'brand', 'model', 'categoryId', 'cash', 'inst', 'description', 'specs'];
const k = (key: string) => `am:draft:${key}`;

export function loadDraft(key: string): DraftForm | null {
  try {
    const raw = localStorage.getItem(k(key));
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!KEYS.every((f) => typeof o[f] === 'string')) return null;
    return o as unknown as DraftForm;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, form: DraftForm): void {
  try {
    localStorage.setItem(k(key), JSON.stringify(form));
  } catch {
    /* ignore */
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(k(key));
  } catch {
    /* ignore */
  }
}
