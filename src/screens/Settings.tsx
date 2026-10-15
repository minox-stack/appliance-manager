import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useFilters } from '../app/context.ts';
import { useStore } from '../app/store.tsx';
import { importBackup, makeBackupFile } from '../db/backup.ts';
import type { ImportResult } from '../db/backup.ts';
import { clearAll } from '../db/repo.ts';
import { parseBackup } from '../lib/backupFormat.ts';
import type { BackupFile } from '../lib/backupFormat.ts';
import { buildCsv } from '../lib/csv.ts';
import { friendlyError } from '../lib/errors.ts';
import { downloadFile, readFileText, saveOrShare } from '../lib/files.ts';
import { formatBytes, formatDate, todayStamp } from '../lib/format.ts';
import { setPrefs, usePrefs } from '../lib/prefs.ts';
import { getStorageInfo, requestPersistence } from '../lib/storage.ts';
import type { StorageInfo } from '../lib/storage.ts';
import { normalizeText } from '../lib/search.ts';
import { Icon } from '../ui/Icon.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useToast } from '../ui/Toast.tsx';

const MAX_RESTORE_BYTES = 300 * 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;

export function Settings() {
  const { products, categories, reload } = useStore();
  const f = useFilters();
  const toast = useToast();
  const prefs = usePrefs();

  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [ready, setReady] = useState<File | null>(null); // ملف جاهز للحفظ
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<{ file: BackupFile; name: string } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [understand, setUnderstand] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [wiping, setWiping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getStorageInfo().then(setStorage);
  }, [products.length]);

  const imagesInBackup = pending ? pending.file.products.filter((p) => p.image).length : 0;

  /* ---------- التصدير ---------- */
  const exportJson = async () => {
    setExporting(true);
    try {
      setReady(await makeBackupFile());
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    const csv = buildCsv(products, categories);
    // BOM حتى يعرض Excel الحروف العربية بشكل صحيح
    setReady(new File(['﻿' + csv], `appliances-${todayStamp()}.csv`, { type: 'text/csv' }));
  };

  const isBackup = ready?.name.endsWith('.json') ?? false;
  const markBackedUp = () => {
    if (isBackup) setPrefs({ lastBackupAt: Date.now() });
  };

  const onSave = async () => {
    if (!ready) return;
    const r = await saveOrShare(ready);
    if (r === 'cancelled') return;
    markBackedUp();
    toast(r === 'shared' ? 'تمت المشاركة' : 'تم تنزيل الملف');
    setReady(null);
  };
  const onDownload = () => {
    if (!ready) return;
    downloadFile(ready);
    markBackedUp();
    toast('تم تنزيل الملف');
    setReady(null);
  };

  /* ---------- الاستعادة ---------- */
  const onPickBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_RESTORE_BYTES) {
      toast('الملف كبير جدًا ليكون نسخة احتياطية صالحة.', 'error');
      return;
    }
    try {
      const parsed = parseBackup(await readFileText(file));
      setMode('merge');
      setUnderstand(false);
      setPending({ file: parsed, name: file.name });
    } catch (err) {
      toast(friendlyError(err), 'error');
    }
  };

  const describe = (r: ImportResult): string => {
    if (mode === 'replace') return `تمت الاستعادة: ${r.added} جهاز`;
    const parts = [`${r.added} جديد`];
    if (r.updated) parts.push(`${r.updated} محدّث`);
    if (r.skipped) parts.push(`${r.skipped} بلا تغيير`);
    return `تم الدمج: ${parts.join('، ')}`;
  };

  const doRestore = async () => {
    if (!pending) return;
    setRestoring(true);
    try {
      const r = await importBackup(pending.file, mode);
      await reload();
      f.reset();
      toast(describe(r));
      setPending(null);
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setRestoring(false);
    }
  };

  /* ---------- مسح كل شيء ---------- */
  const doWipe = async () => {
    setWiping(true);
    try {
      await clearAll();
      await reload();
      f.reset();
      toast('تم مسح كل البيانات');
      setWipe(false);
      setWipeText('');
    } catch (e) {
      toast(friendlyError(e), 'error');
    } finally {
      setWiping(false);
    }
  };

  const lastBackup = prefs.lastBackupAt;
  const stale = lastBackup === null ? products.length > 0 : Date.now() - lastBackup > 7 * DAY;

  return (
    <>
      <header className="page-head">
        <h1 className="title">الإعدادات</h1>
        <p className="muted">إدارة البيانات والنسخ الاحتياطي.</p>
      </header>

      {/* ---------- التخصيص ---------- */}
      <section className="panel surface">
        <h2>التخصيص</h2>
        <div className="field">
          <label htmlFor="s-owner">اسمك (للتحية في الرئيسية)</label>
          <input
            id="s-owner"
            className="input"
            value={prefs.ownerName}
            maxLength={30}
            onChange={(e) => setPrefs({ ownerName: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="s-shop">اسم المحل (عنوان الرئيسية)</label>
          <input
            id="s-shop"
            className="input"
            value={prefs.shopName}
            maxLength={40}
            placeholder="مخزون الأجهزة"
            onChange={(e) => setPrefs({ shopName: e.target.value })}
            autoComplete="off"
          />
        </div>
      </section>

      {/* ---------- النسخ الاحتياطي ---------- */}
      <section className="panel surface">
        <h2>النسخ الاحتياطي</h2>
        <p className={`status ${stale ? 'status-warn' : ''}`}>
          <Icon name={stale ? 'alert' : 'check'} size={18} />
          {lastBackup === null
            ? products.length > 0
              ? 'لم تُنشئ نسخة احتياطية بعد.'
              : 'لا توجد بيانات تحتاج نسخة بعد.'
            : `آخر نسخة: ${formatDate(lastBackup)}${stale ? ' — يُفضَّل تحديثها.' : ''}`}
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={exportJson} disabled={exporting}>
          <Icon name="download" size={20} /> {exporting ? 'جارٍ التجهيز…' : 'تصدير نسخة احتياطية'}
        </button>
        <p className="hint">ملف JSON يحتوي كل الأجهزة والتصنيفات والمفضلة والصور. احفظه في «الملفات» أو أرسله لنفسك.</p>

        <button type="button" className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={20} /> استعادة من نسخة احتياطية
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onPickBackup} />

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={exportCsv}
          disabled={products.length === 0}
        >
          <Icon name="download" size={20} /> تصدير جدول CSV
        </button>
        <p className="hint">للفتح في Excel أو Numbers. لا يتضمن الصور ولا يصلح للاستعادة.</p>
      </section>

      {/* ---------- حول التخزين ---------- */}
      <section className="panel surface">
        <h2>أين تُحفظ بياناتك؟</h2>
        <ul className="plain">
          <li>
            تُحفظ داخل متصفح <strong>هذا الجهاز فقط</strong> (IndexedDB). لا تُرسل إلى أي خادم، ولا توجد حسابات ولا
            تتبّع.
          </li>
          <li>
            <strong>ليست نسخة سحابية:</strong> لا تتزامن بين الأجهزة، وقد تُفقد إذا مسحت بيانات Safari أو غيّرت عنوان
            الموقع أو ضاقت مساحة الجهاز. لذلك صدّر نسخة احتياطية بانتظام.
          </li>
          <li>
            قفل الجهاز (رمز الدخول) أو أي قفل للتطبيق <strong>ليس تشفيرًا</strong> للبيانات؛ التخزين في المتصفح غير مشفّر.
          </li>
        </ul>
        {storage ? (
          <p className="hint">
            {storage.usage !== null ? `المساحة المستخدمة: ${formatBytes(storage.usage)}. ` : ''}
            {storage.persisted === true
              ? 'التخزين الدائم: مفعّل (أقل عرضة للحذف التلقائي، دون ضمان مطلق).'
              : storage.persisted === false
                ? 'التخزين الدائم: غير مفعّل — قد يحذف النظام البيانات عند ضيق المساحة.'
                : 'حالة التخزين الدائم: غير معروفة في هذا المتصفح.'}
          </p>
        ) : null}
        {storage?.persisted === false ? (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={async () => {
              const ok = await requestPersistence();
              setStorage(await getStorageInfo());
              toast(ok ? 'تم تفعيل التخزين الدائم' : 'لم يوافق المتصفح على الطلب', ok ? 'success' : 'info');
            }}
          >
            طلب حماية البيانات
          </button>
        ) : null}
      </section>

      {/* ---------- التثبيت ---------- */}
      <section className="panel surface">
        <h2>تثبيت التطبيق على الآيفون</h2>
        <ol className="plain steps">
          <li>افتح الموقع في <strong>Safari</strong> (وليس داخل تطبيق آخر).</li>
          <li>اضغط زر <strong>المشاركة</strong> (المربع والسهم للأعلى).</li>
          <li>مرّر للأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>.</li>
          <li>اضغط <strong>«إضافة»</strong>، ثم افتح التطبيق من أيقونته.</li>
        </ol>
        <p className="hint">يحتاج التثبيت وتشغيل «بدون إنترنت» أن يكون الموقع على HTTPS.</p>
      </section>

      {/* ---------- منطقة الخطر ---------- */}
      <section className="panel surface danger-zone">
        <h2>منطقة الخطر</h2>
        <button type="button" className="btn btn-danger btn-block" onClick={() => setWipe(true)}>
          <Icon name="trash" size={20} /> مسح كل البيانات
        </button>
        <p className="hint">يحذف كل الأجهزة والصور والتصنيفات المخصّصة من هذا الجهاز نهائيًا.</p>
      </section>

      <p className="meta">أسعار الأجهزة · الإصدار 1.0 · {products.length} جهاز</p>

      {/* ---------- ورقة: الملف جاهز ---------- */}
      <Sheet
        open={ready !== null}
        title={isBackup ? 'النسخة الاحتياطية جاهزة' : 'ملف CSV جاهز'}
        onClose={() => setReady(null)}
        footer={
          <div className="foot-stack">
            <button type="button" className="btn btn-primary" onClick={onSave}>
              <Icon name="upload" size={20} /> حفظ / مشاركة الملف
            </button>
            <button type="button" className="btn btn-ghost" onClick={onDownload}>
              <Icon name="download" size={20} /> تنزيل مباشر
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setReady(null)}>
              إغلاق
            </button>
          </div>
        }
      >
        <p className="sheet-text">
          الملف: <bdi>{ready?.name}</bdi> ({ready ? formatBytes(ready.size) : ''}).
          {isBackup
            ? ' اختر «حفظ / مشاركة» ثم «حفظ في الملفات» للاحتفاظ به خارج المتصفح.'
            : ' يمكن فتحه في Excel أو Numbers.'}
        </p>
      </Sheet>

      {/* ---------- ورقة: معاينة الاستعادة ---------- */}
      <Sheet
        open={pending !== null}
        title="استعادة نسخة احتياطية"
        onClose={() => !restoring && setPending(null)}
        footer={
          <div className="foot-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)} disabled={restoring}>
              إلغاء
            </button>
            <button
              type="button"
              className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-primary'}`}
              onClick={doRestore}
              disabled={restoring || (mode === 'replace' && !understand)}
            >
              {restoring ? 'جارٍ الاستعادة…' : mode === 'replace' ? 'استبدال كل البيانات' : 'دمج النسخة'}
            </button>
          </div>
        }
      >
        {pending ? (
          <>
            <p className="sheet-text">
              الملف: <bdi>{pending.name}</bdi>
              {pending.file.createdAt ? <> · أُنشئ في {formatDate(Date.parse(pending.file.createdAt) || Date.now())}</> : null}
            </p>
            <div className="preview">
              <div>
                <strong>{pending.file.products.length}</strong>
                <span>جهاز</span>
              </div>
              <div>
                <strong>{pending.file.categories.length}</strong>
                <span>تصنيف</span>
              </div>
              <div>
                <strong>{imagesInBackup}</strong>
                <span>صورة</span>
              </div>
            </div>
            <p className="hint">
              الحالي على هذا الجهاز: {products.length} جهاز، {categories.length} تصنيف.
            </p>

            <div className="seg" role="radiogroup" aria-label="طريقة الاستعادة">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'merge'}
                className={`seg-item ${mode === 'merge' ? 'seg-on' : ''}`}
                onClick={() => setMode('merge')}
              >
                دمج (موصى به)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'replace'}
                className={`seg-item ${mode === 'replace' ? 'seg-on' : ''}`}
                onClick={() => setMode('replace')}
              >
                استبدال الكل
              </button>
            </div>

            {mode === 'merge' ? (
              <p className="hint">
                يضيف الأجهزة الجديدة ويحتفظ بما لديك. إن وُجد الجهاز نفسه في الطرفين يُؤخذ الأحدث تعديلًا. لا يُحذف شيء.
              </p>
            ) : (
              <>
                <p className="err">سيتم حذف كل بياناتك الحالية واستبدالها بمحتوى هذه النسخة.</p>
                <label className="check">
                  <input type="checkbox" checked={understand} onChange={(e) => setUnderstand(e.target.checked)} />
                  <span>أفهم أن البيانات الحالية ستُحذف (يُفضَّل تصدير نسخة منها أولًا).</span>
                </label>
              </>
            )}
          </>
        ) : null}
      </Sheet>

      {/* ---------- ورقة: مسح كل شيء ---------- */}
      <Sheet
        open={wipe}
        title="مسح كل البيانات؟"
        onClose={() => !wiping && setWipe(false)}
        footer={
          <div className="foot-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setWipe(false)} disabled={wiping}>
              إلغاء
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={doWipe}
              disabled={wiping || normalizeText(wipeText) !== 'مسح'}
            >
              {wiping ? 'لحظة…' : 'مسح نهائيًا'}
            </button>
          </div>
        }
      >
        <p className="sheet-text">
          سيُحذف كل شيء من هذا الجهاز نهائيًا: <strong>{products.length}</strong> جهاز مع صورها، وكل التصنيفات
          المخصّصة. لا يمكن التراجع إلا إذا كانت لديك نسخة احتياطية.
        </p>
        <label className="field">
          <span>للتأكيد اكتب كلمة «مسح»:</span>
          <input
            className="input"
            value={wipeText}
            onChange={(e) => setWipeText(e.target.value)}
            autoComplete="off"
            aria-label="كلمة التأكيد"
          />
        </label>
      </Sheet>
    </>
  );
}
