import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/restriction-assets/',
  esbuild: {
    legalComments: 'none',
  },
  build: {
    outDir: 'dist',
    assetsDir: '.',
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (info) => {
          const ext = (info.name || '').split('.').pop()
          const dir = ext === 'css' ? 'assets/css' : 'assets/media'
          return dir + '/[name]-[hash][extname]'
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pinia') || id.includes('@vue/devtools')) return 'vendor-pinia'
            if (id.includes('@vue') || id.includes('/vue/')) return 'vendor-vue'
            return 'vendor-core'
          }
          const svc = id.match(/\/src\/services\/([^/]+)\.js$/)
          if (svc) return 'service-' + svc[1]
          const st = id.match(/\/src\/stores\/([^/]+)\.js$/)
          if (st) return 'store-' + st[1]
          const cmp = id.match(/\/src\/composables\/([^/]+)\.js$/)
          if (cmp) return 'composable-' + cmp[1]
          const loc = id.match(/\/src\/i18n\/([^/]+)\.js$/)
          if (loc) return 'locale-' + loc[1]
        }
      }
    }
  }
})
