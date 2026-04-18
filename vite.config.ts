import { defineConfig } from 'vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Present-JSON',
  version: '0.1.0',
  description: 'Render JSON responses as user-templated HTML.',
  action: {
    default_popup: 'src/popup/popup.html',
    default_icon: {
      '16': 'public/icon-16.png',
      '48': 'public/icon-48.png',
      '128': 'public/icon-128.png',
    },
  },
  options_page: 'src/options/options.html',
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  permissions: ['storage', 'scripting', 'tabs'],
  host_permissions: ['<all_urls>'],
  icons: {
    '16': 'public/icon-16.png',
    '48': 'public/icon-48.png',
    '128': 'public/icon-128.png',
  },
});

export default defineConfig({
  plugins: [crx({ manifest })],
  build: { outDir: 'dist', emptyOutDir: true },
});
