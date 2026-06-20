import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function copyMainHelpers() {
  return {
    name: 'copy-main-helpers',
    closeBundle() {
      fs.copyFileSync(
        path.resolve(__dirname, 'src/main/appMonitor.cjs'),
        path.resolve(__dirname, 'out/main/appMonitor.cjs'),
      )
    },
  }
}

export default defineConfig({
  main: {
    // 主进程不打包 — 直接用 CJS 入口 src/main/index.cjs
    plugins: [copyMainHelpers()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/index.ts'),
        },
      },
      // 跳过空构建
      emptyOutDir: false,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/main/preload.ts'),
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer'),
      },
    },
  },
})
