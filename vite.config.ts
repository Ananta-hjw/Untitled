import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        (일반 배포용)
// `npm run build:single` -> dist-single/ (HTML 한 파일로 묶은 공유용)
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true, port: 5173 },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2500,
  },
}));
