import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const designSystem = path.resolve(here, '../design-system');
const dsSources = path.join(designSystem, 'components/src');
const dsTokensCss = path.join(designSystem, 'assets/Source/constellation.css');

/**
 * Uses the design system as it is, without editing its files:
 * - its components take React from `window.React` (./react); give them the real module instead;
 * - its generated CSS loads fonts from `fonts/` beside the page; point that at design-system/fonts.
 */
function designSystemAsIs(): Plugin {
  return {
    name: 'constellation-design-system',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './react' && importer?.startsWith(dsSources)) return path.join(here, 'src/ds/react.ts');
      return null;
    },
    transform(code, id) {
      if (id.split('?')[0] === dsTokensCss) return code.replaceAll('url("fonts/', 'url("../../fonts/');
      return null;
    },
  };
}

export default defineConfig({
  plugins: [designSystemAsIs(), react()],
  resolve: {
    // The design system's JSX imports react/jsx-runtime from outside this folder: resolve React from here.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@ds-src': path.join(dsSources, 'index.tsx'),
      '@ds': path.join(here, 'src/ds/index.ts'),
      '@ds-css': designSystem,
    },
  },
  // Served from localhost only, so one bundle of this size is fine.
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    host: '127.0.0.1',
    port: 7338,
    strictPort: true,
    fs: { allow: [here, designSystem] },
    proxy: { '/api': { target: 'http://127.0.0.1:7337', ws: true } },
  },
});
