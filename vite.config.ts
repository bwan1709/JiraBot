import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Express backend target for the dev proxy.
// `npm run dev` starts the backend on 3344 (see package.json), so default to that.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3344';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Static passthrough assets (favicon.ico) copied verbatim into dist/.
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      // Keep cookies same-origin by proxying API/auth calls to Express.
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Two entries mirror the static files the backend auth middleware expects.
      input: {
        main: 'index.html',
        login: 'login.html',
      },
      output: {
        // The big on-demand libs are dynamically imported in app code, so we leave
        // them un-chunked here — Rollup keeps them in their own async chunks that
        // load only when needed (charts when the dashboard renders; docx/xlsx on
        // export). Everything else (react, antd, dayjs, rc-*) goes to one shared
        // `vendor` chunk cached across both pages. Returning undefined avoids the
        // circular-chunk problems that fine-grained splitting caused.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // docx/xlsx are only reached via dynamic import() on export — isolate them.
          if (id.includes('node_modules/docx')) return 'docx';
          if (id.includes('node_modules/xlsx')) return 'xlsx';
          // Shared, cached vendor chunks for the always-on UI libs (both pages use them).
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/node_modules\/(antd|@ant-design\/icons|@rc-component|rc-)/.test(id)) return 'antd-vendor';
          // IMPORTANT: do NOT manually chunk @ant-design/charts / @antv. They're only
          // imported through React.lazy(ChartsRow), so Rollup keeps them in an async
          // chunk that downloads only when the dashboard renders — never on /login.html.
          return undefined;
        },
      },
    },
  },
});
