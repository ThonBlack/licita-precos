import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // exceljs fica bundlado: externo, o electron-builder deduplica errado as cópias
    // aninhadas de readable-stream e o app quebra com "Cannot find module" no asar
    plugins: [externalizeDepsPlugin({ exclude: ['exceljs'] })]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
