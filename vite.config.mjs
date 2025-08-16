import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 5173,       // 自定义端口
    proxy: {
      '/records': 'http://192.168.0.7:3001',
      '/api': 'http://192.168.0.7:3001',  // 使用实际的服务器IP地址
    }
  }
})
