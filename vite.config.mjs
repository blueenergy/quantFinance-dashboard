import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    vue(),
    // Generate gzip and brotli compressed assets for production
    compression({ algorithm: 'gzip', ext: '.gz', deleteOriginFile: false }),
    compression({ algorithm: 'brotliCompress', ext: '.br', deleteOriginFile: false })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue')) return 'vendor-vue'
            if (id.includes('vuetify')) return 'vendor-vuetify'
            if (id.includes('echarts')) return 'vendor-echarts'
            if (id.includes('axios')) return 'vendor-axios'
            return 'vendor'
          }
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',  // 允许外部访问
    port: 5173,       // 自定义端口
    proxy: {
      '/records': 'http://localhost:3001',
      '/api': 'http://localhost:3001',  // 添加API路径代理
    }
  }
})
