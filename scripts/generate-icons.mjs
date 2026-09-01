// ============================================================
// رِفق — توليد أيقونات PWA من هوية رِفق البصرية
// قلب أبيض على خلفية بنية (نفس ألوان favicon.svg)
// رسم vector نقي — يترسم موثوقًا في كل المقاسات والمكتبات
// التشغيل: npm run icons (يُنفَّذ محليًا؛ مخرجاته تُرفع للـrepo)
// ============================================================

import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public');

const BG = '#8a6d3b'; // نفس لون favicon.svg
const HEART = '#fffdf9'; // أبيض دافئ (لون السطح في رِفق)

/** قلب vector — يُرسم داخل viewBox 100×100 */
function heartSvg({ size, bgRadius, heartScale }) {
  // heartScale: نسبة حجم القلب بالنسبة للعرض الكامل
  const s = 100;
  const hs = s * heartScale;
  const pad = (s - hs) / 2;
  // مسار قلب عادي متمركز حول (50,50) بمقياس 64 — يُحوَّل للمقياس والإزاحة المطلوبة
  const k = hs / 64;
  const tx = pad + hs / 2; // مركز أفقي
  const ty = pad + hs * 0.52; // مركز رأسي (القلب يميل للأسفل بصريًا)
  const path =
    'M0 -21 C0 -21 -25.6 -9.6 -25.6 -9.6 C-32 -6.4 -32 -19.2 -25.6 -25.6 ' +
    'C-19.2 -32 -6.4 -28.8 0 -19.2 C6.4 -28.8 19.2 -32 25.6 -25.6 ' +
    'C32 -19.2 32 -6.4 25.6 -9.6 L0 21 Z';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${bgRadius ? (size * 22) / 100 : 0}" fill="${BG}"/>
  <path d="${path}" fill="${HEART}" transform="translate(${tx} ${ty}) scale(${k})"/>
</svg>`;
}

const targets = [
  { file: 'pwa-192.png', size: 192, bgRadius: true, heartScale: 0.64 },
  { file: 'pwa-512.png', size: 512, bgRadius: true, heartScale: 0.64 },
  { file: 'pwa-512-maskable.png', size: 512, bgRadius: false, heartScale: 0.52 },
  { file: 'apple-touch-icon.png', size: 180, bgRadius: false, heartScale: 0.64 }
];

for (const t of targets) {
  await sharp(Buffer.from(heartSvg(t)))
    .png()
    .toFile(resolve(outDir, t.file));
  console.log(`✓ ${t.file} (${t.size}×${t.size})`);
}
console.log('تم توليد كل أيقونات رِفق 🤍');