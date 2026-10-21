import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages（/BustedUp/ 配下）でも動くように相対パスで出力する
  base: './',
  plugins: [react(), tailwindcss()],
})
