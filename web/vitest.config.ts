import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// The app's own Vite config (design-system aliases included), run in Node: the tests cover logic, not the DOM.
export default mergeConfig(viteConfig, defineConfig({ test: { include: ['src/**/*.test.ts'], environment: 'node', setupFiles: ['src/test/window.ts'] } }));
