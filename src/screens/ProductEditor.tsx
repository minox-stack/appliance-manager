import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useFilters, useNav } from '../app/context.ts';
import { useStore } from '../app/store.tsx';
import type { ImageChange } from '../db/repo.ts';
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts.ts';
import type { DraftForm } from '../lib/drafts.ts';
import { friendlyError, ImageError } from '../lib/errors.ts';
import { formatNumber, parsePrice, toLatinDigits } from '../lib/format.ts';
import { blobToBuffer, processImageFile } from '../lib/image.ts';
import { MAX_PRICE } from '../types.ts';
import type { Category, Product } from '../types.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { Icon } from '../ui/Icon.tsx';
import { Overlay } from '../ui/Overlay.tsx';
import { ProductImage } from '../ui/ProductImage.tsx';
import { ConfirmSheet } from '../ui/Sheet.tsx';
import { useToast } from '../ui/Toast.tsx';

type Form = DraftForm;
type Errors = Partial<Record<keyof Form, string>>;
type Img =
  | { kind: 'keep' }
  | { kind: 'none' }
  | { kind: 'new'; full: Blob; thumb: Blob; url: string };

const EMPTY: Form = { name: '', brand: '', model: '', categoryId: '', cash: '', inst: '', description: '', specs: '' };
const FIELDS = Object.keys(EMPTY) as (keyof Form)[];

function priceError(raw: string, label: string): string | undefined {
  const t = raw.trim();
  if (t === '') return `${label} مطلوب.`;
  if (t.startsWith('-')) return `${label} لا يمكن أن يكون سالبًا.`;
  const n = parsePrice(t);
  if (n === null) return `أدخل ${label} بأرقام صحيحة فقط.`;
  if (n > MAX_PRICE) return `${label} كبير جدًا.`;
  return undefined;
}

function validate(f: Form, categories: Category[]): Errors {
  const e: Errors = {};
  const name = f.name.trim();
  if (!name) e.name = 'اسم الجهاز مطلوب.';
  else if (name.length > 120) e.name = 'الاسم طويل جدًا (120 حرفًا كحد أقصى).';
  if (!f.categoryId) e.categoryId = 'اختر تصنيف الجهاز.';
  else if (!categories.some((c) => c.id === f.categoryId)) e.categoryId = 'التصنيف المختار غير موجود.';
  const ce = priceError(f.cash, 'سعر الكاش');
  if (ce) e.cash = ce;
  const ie = priceError(f.inst, 'سعر التقسيط');
  if (ie) e.inst = ie;
  return e;
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? 'field-err' : ''}`} id={`f-${id}`}>
      <label htmlFor={`i-${id}`}>{label}</label>
      {children}
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function ProductEditor({ id }: { id: string | null }) {
  const { products } = useStore();
  const nav = useNav();
  const product = id ? products.find((p) => p.id === id) : undefined;
  if (id && !product) {
    return (
      <Overlay title="تعديل الجهاز" onBack={nav.back}>
        <EmptyState icon="alert" title="هذا الجهاز غير موجود" text="ربما تم حذفه." />
      </Overlay>
    );
  }
  return <EditorForm product={product} />;
}

function EditorForm({ product }: { product?: Product }) {
  const { categories, saveProduct } = useStore();
  const nav = useNav();
  const filters = useFilters();
  const toast = useToast();

  const draftKey = product ? product.id : 'new';
  const [initial] = useState<Form>(() =>
    product
      ? {
          name: product.name,
          brand: product.brand,
          model: product.model,
          categoryId: product.categoryId,
          cash: String(product.cashPrice),
          inst: String(product.installmentPrice),
          description: product.description,
          specs: product.specs,
        }
      : { ...EMPTY, categoryId: filters.categoryId !== 'all' ? filters.categoryId : '' },
  );
  const [restored] = useState<Form | null>(() => loadDraft(draftKey));
  const [form, setForm] = useState<Form>(() => restored ?? initial);
  const [img, setImg] = useState<Img>(() => (product?.hasImage ? { kind: 'keep' } : { kind: 'none' }));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [discard, setDiscard] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    if (restored) toast('تم استرجاع مسودة غير محفوظة', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تحرير رابط معاينة الصورة الجديدة عند استبدالها أو إغلاق الصفحة
  useEffect(() => {
    return () => {
      if (img.kind === 'new') URL.revokeObjectURL(img.url);
    };
  }, [img]);

  const formChanged = useMemo(() => FIELDS.some((k) => form[k] !== initial[k]), [form, initial]);
  const dirty = formChanged || img.kind === 'new' || (img.kind === 'none' && !!product?.hasImage);

  // حفظ مسودة تلقائيًا (نصوص فقط)
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (done.current) return;
      if (formChanged) saveDraft(draftKey, form);
      else clearDraft(draftKey);
    }, 400);
    return () => window.clearTimeout(t);
  }, [form, formChanged, draftKey]);

  const set =
    (k: keyof Form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [k]: value }));
      if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
    };

  const setPrice = (k: 'cash' | 'inst') => (e: ChangeEvent<HTMLInputElement>) => {
    const value = toLatinDigits(e.target.value).replace(/[^\d-]/g, '');
    setForm((f) => ({ ...f, [k]: value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // يسمح باختيار نفس الصورة مجددًا
    if (!file) return;
    setImgBusy(true);
    try {
      const r = await processImageFile(file);
      setImg({ kind: 'new', full: r.full, thumb: r.thumb, url: URL.createObjectURL(r.full) });
    } catch (err) {
      toast(err instanceof ImageError ? err.message : 'تعذّر قراءة الصورة. جرّب صورة أخرى.', 'error');
    } finally {
      setImgBusy(false);
    }
  };

  const close = () => {
    done.current = true;
    clearDraft(draftKey);
    nav.back();
  };
  const cancel = () => (dirty ? setDiscard(true) : close());

  const save = async () => {
    const er = validate(form, categories);
    setErrors(er);
    const first = FIELDS.find((k) => er[k]);
    if (first) {
      document.getElementById(`f-${first}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('يرجى تصحيح الحقول المحددة.', 'error');
      return;
    }
    setSaving(true);
    try {
      let change: ImageChange;
      if (img.kind === 'new') {
        const [data, thumb] = await Promise.all([blobToBuffer(img.full), blobToBuffer(img.thumb)]);
        change = { kind: 'set', type: 'image/jpeg', data, thumb };
      } else if (img.kind === 'none' && product?.hasImage) {
        change = { kind: 'remove' };
      } else {
        change = { kind: 'keep' };
      }
      const saved = await saveProduct(
        {
          id: product?.id,
          name: form.name,
          brand: form.brand,
          model: form.model,
          categoryId: form.categoryId,
          cashPrice: parsePrice(form.cash) ?? 0,
          installmentPrice: parsePrice(form.inst) ?? 0,
          description: form.description,
          specs: form.specs,
        },
        change,
      );
      if (saved) close();
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const cashN = parsePrice(form.cash);
  const instN = parsePrice(form.inst);
  const hasPreview = img.kind === 'new' || (img.kind === 'keep' && !!product);

  return (
    <Overlay
      title={product ? 'تعديل الجهاز' : 'إضافة جهاز'}
      onBack={cancel}
      footer={
        <div className="foot-actions">
          <button type="button" className="btn btn-ghost" onClick={cancel} disabled={saving}>
            إلغاء
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || imgBusy}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      }
    >
      {/* ---------- الصورة ---------- */}
      <section className="photo surface" aria-label="صورة الجهاز">
        <div className="photo-box">
          {img.kind === 'new' ? (
            <img src={img.url} alt="معاينة صورة الجهاز" />
          ) : img.kind === 'keep' && product ? (
            <ProductImage product={product} full />
          ) : (
            <div className="photo-empty">
              <Icon name="camera" size={36} />
              <span>لم تُضَف صورة بعد</span>
            </div>
          )}
          {imgBusy ? <div className="photo-busy">جارٍ معالجة الصورة…</div> : null}
        </div>
        <div className="photo-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => camRef.current?.click()} disabled={imgBusy}>
            <Icon name="camera" size={18} /> التقاط صورة
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => libRef.current?.click()} disabled={imgBusy}>
            <Icon name="photo" size={18} /> {hasPreview ? 'استبدال' : 'من الصور'}
          </button>
          {hasPreview ? (
            <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setImg({ kind: 'none' })}>
              <Icon name="trash" size={18} /> إزالة
            </button>
          ) : null}
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
        <input ref={libRef} type="file" accept="image/*" hidden onChange={onPick} />
      </section>

      {/* ---------- الحقول ---------- */}
      <Field id="name" label="اسم الجهاز" error={errors.name}>
        <input
          id="i-name"
          className="input"
          value={form.name}
          onChange={set('name')}
          maxLength={120}
          placeholder="مثال: ثلاجة بابين"
          autoComplete="off"
          enterKeyHint="next"
        />
      </Field>

      <div className="two">
        <Field id="brand" label="الماركة">
          <input
            id="i-brand"
            className="input"
            value={form.brand}
            onChange={set('brand')}
            maxLength={60}
            placeholder="Condor"
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>
        <Field id="model" label="الموديل">
          <input
            id="i-model"
            className="input"
            value={form.model}
            onChange={set('model')}
            maxLength={60}
            placeholder="RS-25"
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="next"
          />
        </Field>
      </div>

      <Field id="categoryId" label="التصنيف" error={errors.categoryId}>
        <select id="i-categoryId" className="input select" value={form.categoryId} onChange={set('categoryId')}>
          <option value="" disabled>
            اختر التصنيف
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="two">
        <Field
          id="cash"
          label="سعر الكاش (دج)"
          error={errors.cash}
          hint={cashN !== null ? `${formatNumber(cashN)} دج` : undefined}
        >
          <input
            id="i-cash"
            className="input num-input"
            value={form.cash}
            onChange={setPrice('cash')}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="85000"
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>
        <Field
          id="inst"
          label="سعر التقسيط (دج)"
          error={errors.inst}
          hint={instN !== null ? `${formatNumber(instN)} دج` : undefined}
        >
          <input
            id="i-inst"
            className="input num-input"
            value={form.inst}
            onChange={setPrice('inst')}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="105000"
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>
      </div>

      <Field id="description" label="وصف الجهاز">
        <textarea
          id="i-description"
          className="input"
          rows={3}
          value={form.description}
          onChange={set('description')}
          maxLength={2000}
          placeholder="ملاحظات عن الجهاز، اللون، الضمان…"
        />
      </Field>

      <Field id="specs" label="المواصفات">
        <textarea
          id="i-specs"
          className="input"
          rows={5}
          value={form.specs}
          onChange={set('specs')}
          maxLength={4000}
          placeholder={'السعة: 450 لتر\nنوفروست\nفئة الطاقة: A+'}
        />
      </Field>

      <ConfirmSheet
        open={discard}
        title="تجاهل التغييرات؟"
        message="لديك تعديلات غير محفوظة. إن خرجت الآن فستُفقد."
        confirmLabel="تجاهل والخروج"
        cancelLabel="متابعة التعديل"
        danger
        onConfirm={() => {
          setDiscard(false);
          close();
        }}
        onCancel={() => setDiscard(false)}
      />
    </Overlay>
  );
}
