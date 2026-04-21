import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx, defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Freshet',
  version: '1.1.0',
  description: 'Thaw any JSON URL into a more useful page. Per-URL Liquid templates turn raw API responses into proper dashboards.',
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
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'tabs'],
  commands: {
    'toggle-raw': {
      suggested_key: {
        default: 'Ctrl+Shift+J',
        mac: 'Command+Shift+J',
      },
      description: 'Toggle rendered / raw view on a matched page',
    },
  },
  host_permissions: ['<all_urls>'],
  icons: {
    '16': 'public/icon-16.png',
    '48': 'public/icon-48.png',
    '128': 'public/icon-128.png',
  },
});

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: { outDir: 'dist', emptyOutDir: true },
});
