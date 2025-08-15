import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/records': 'http://localhost:3001',
      '/api': 'http://localhost:3001',  // 添加API路径代理
    }
  }
})
