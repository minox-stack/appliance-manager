import { ImageError } from './errors.ts';

export const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError('تعذّر قراءة هذه الصورة. جرّب صورة بصيغة JPG أو PNG.'));
    img.src = url;
  });
}

function render(img: HTMLImageElement, max: number, quality: number): Promise<Blob> {
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) throw new ImageError('الصورة فارغة أو تالفة.');
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('المتصفح لا يدعم معالجة الصور.');
  ctx.fillStyle = '#ffffff'; // الصور الشفافة تصبح بخلفية بيضاء بدل السوداء
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        canvas.width = 0;
        canvas.height = 0;
        if (b) resolve(b);
        else reject(new ImageError('تعذّر ضغط الصورة.'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/** يصغّر ويضغط الصورة: نسخة كاملة (حتى 1400px) ومصغّرة للبطاقات (حتى 420px). */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (file.size === 0) throw new ImageError('الملف فارغ.');
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('حجم الصورة كبير جدًا (الحد الأقصى 30 ميغابايت).');
  if (file.type && !file.type.startsWith('image/')) throw new ImageError('الملف المختار ليس صورة.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const full = await render(img, 1400, 0.85);
    const thumb = await render(img, 420, 0.78);
    return { full, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToBuffer(b: Blob): Promise<ArrayBuffer> {
  if (typeof b.arrayBuffer === 'function') return b.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(b);
  });
}
