"""يولّد أيقونات التطبيق (PNG) بدون أي مكتبات خارجية عدا Pillow.
التشغيل:  python3 scripts/make-icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
os.makedirs(OUT, exist_ok=True)
S = 1024  # نرسم بدقة عالية ثم نصغّر


def gradient(size, c1, c2):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img


def make(safe_scale: float, rounded: bool) -> Image.Image:
    base = gradient(S, (9, 14, 42), (26, 22, 78))
    glow = Image.new('RGB', (S, S), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((S * 0.35, -S * 0.25, S * 1.15, S * 0.55), fill=(88, 92, 240))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.14))
    base = Image.blend(base, Image.composite(glow, base, Image.new('L', (S, S), 110)), 0.55)

    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w = S * safe_scale
    cx, cy = S / 2, S / 2
    x0, x1 = cx - w * 0.2, cx + w * 0.2
    y0, y1 = cy - w * 0.34, cy + w * 0.34
    # جسم الثلاجة بزجاج شفاف
    d.rounded_rectangle((x0, y0, x1, y1), radius=w * 0.07, fill=(255, 255, 255, 46), outline=(255, 255, 255, 235), width=int(S * 0.018))
    d.line((x0, cy - w * 0.08, x1, cy - w * 0.08), fill=(255, 255, 255, 235), width=int(S * 0.018))
    hw = int(S * 0.018)
    d.line((x0 + w * 0.07, y0 + w * 0.07, x0 + w * 0.07, y0 + w * 0.17), fill=(255, 255, 255, 235), width=hw)
    d.line((x0 + w * 0.07, cy + w * 0.0, x0 + w * 0.07, cy + w * 0.14), fill=(255, 255, 255, 235), width=hw)
    # لمعة علوية
    d.rounded_rectangle((x0 + w * 0.02, y0 + w * 0.02, x1 - w * 0.02, y0 + w * 0.12), radius=w * 0.05, fill=(255, 255, 255, 30))

    img = base.convert('RGBA')
    img.alpha_composite(layer)
    if rounded:
        mask = Image.new('L', (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, S, S), radius=int(S * 0.225), fill=255)
        out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img


def save(img: Image.Image, size: int, name: str, flatten: bool = False):
    im = img.resize((size, size), Image.LANCZOS)
    if flatten:
        bg = Image.new('RGB', im.size, (9, 14, 42))
        bg.paste(im, mask=im.split()[3])
        im = bg
    im.save(os.path.join(OUT, name), optimize=True)


regular = make(1.0, rounded=False)
save(regular, 192, 'icon-192.png', flatten=True)
save(regular, 512, 'icon-512.png', flatten=True)
# iOS يضيف الزوايا المستديرة بنفسه؛ نعطيه مربعًا كاملًا بلا شفافية
save(regular, 180, 'apple-touch-icon.png', flatten=True)
# maskable: المحتوى داخل المنطقة الآمنة (80%)
save(make(0.8, rounded=False), 512, 'icon-maskable-512.png', flatten=True)
print('تم إنشاء الأيقونات في', os.path.abspath(OUT))
