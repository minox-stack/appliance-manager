import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * يستبدل __BUILD_ID__ داخل dist/sw.js برقم فريد لكل بناء،
 * فيتغير اسم الكاش تلقائيًا مع كل نسخة جديدة ويُحذف الكاش القديم.
 * (قاعدة البيانات IndexedDB لا تتأثر بذلك إطلاقًا.)
 */
function swBuildId(): Plugin {
  return {
    name: 'sw-build-id',
    apply: 'build',
    closeBundle() {
      const file = 'dist/sw.js';
      if (!existsSync(file)) return;
      const id = Date.now().toString(36);
      writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD_ID__', id));
    },
  };
}

export default defineConfig({
  // مسارات نسبية: يعمل المشروع على أي نطاق أو مجلد فرعي (مثل GitHub Pages).
  base: './',
  plugins: [react(), swBuildId()],
  build: {
    target: ['es2020', 'safari14'],
    sourcemap: false,
  },
});
