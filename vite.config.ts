import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json';

// `npm run build`        -> dist/        (일반 배포용)
// `npm run build:single` -> dist-single/ (HTML 한 파일로 묶은 공유용)
export default defineConfig(({ mode }) => ({
  base: './',
  // 화면에 표시하는 버전은 package.json의 version 하나만 고치면 된다.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { host: true, port: 5173 },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
  },
}));
