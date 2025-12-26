import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      'tldraw/tldraw.css': path.resolve(__dirname, '../tldraw/packages/tldraw/tldraw.css'),
      'tldraw': path.resolve(__dirname, '../tldraw/packages/tldraw/src/index.ts'),
      '@tldraw/editor': path.resolve(__dirname, '../tldraw/packages/editor/src/index.ts'),
      '@tldraw/store': path.resolve(__dirname, '../tldraw/packages/store/src/index.ts'),
      '@tldraw/state': path.resolve(__dirname, '../tldraw/packages/state/src/index.ts'),
      '@tldraw/state-react': path.resolve(__dirname, '../tldraw/packages/state-react/src/index.ts'),
      '@tldraw/tlschema': path.resolve(__dirname, '../tldraw/packages/tlschema/src/index.ts'),
      '@tldraw/utils': path.resolve(__dirname, '../tldraw/packages/utils/src/index.ts'),
      '@tldraw/validate': path.resolve(__dirname, '../tldraw/packages/validate/src/index.ts'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    }
  },
  esbuild: {
    target: 'esnext',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true
      }
    }
  },
  build: {
    // Bump the warning threshold; the bundle is large because tldraw + Radix ship many UI components
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            return 'vendor'
          }
          if (id.includes('/tldraw/packages/')) {
            return 'tldraw-lib'
          }
        }
      },
      // Silence Radix "use client" directives, which are safe to ignore when bundling
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) return
        warn(warning)
      }
    }
  }
})
