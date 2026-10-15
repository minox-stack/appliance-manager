/** خطأ برسالة عربية جاهزة للعرض على المستخدم. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class BackupError extends AppError {}
export class ImageError extends AppError {}

export function friendlyError(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const x = e as { name?: string; message?: string; inner?: { name?: string } } | null;
  const name = x?.name ?? '';
  const inner = x?.inner?.name ?? '';
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError' || /quota/i.test(x?.message ?? '')) {
    return 'مساحة التخزين على الجهاز ممتلئة. احذف بعض الأجهزة أو الصور ثم حاول مجددًا.';
  }
  if (
    ['OpenFailedError', 'DatabaseClosedError', 'SecurityError', 'InvalidStateError', 'MissingAPIError'].includes(name)
  ) {
    return 'تعذّر فتح مخزن البيانات في هذا المتصفح. تأكد أنك لا تستخدم التصفح الخاص ثم أعد المحاولة.';
  }
  return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
}
