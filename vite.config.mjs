import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 5173,       // 自定义端口
    proxy: {
      '/records': 'http://localhost:3001',
      '/api': 'http://localhost:3001',  // 添加API路径代理
    }
  }
})
