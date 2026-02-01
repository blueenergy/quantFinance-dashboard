# quantFinance Dashboard 环境变量配置指南

## 📍 文件位置

`.env` 文件应该放在 **quantFinance Dashboard 项目的根目录**：

```
/home/shuyolin/own/quantFinance-dashboard/
├── .env                    ← 这里！（实际配置文件）
├── .env.example            ← 模板文件
├── vite.config.mjs
├── package.json
├── src/
├── docs/
└── ...
```

## ✅ 快速配置

### 第 1 步：创建 `.env` 文件

在项目根目录创建 `.env` 文件：

```bash
cd /home/shuyolin/own/quantFinance-dashboard
# 复制示例文件
cp .env.example .env
# 或者手动创建
touch .env
```

### 第 2 步：编辑 `.env` 文件

使用编辑器打开 `.env` 文件，配置以下两个关键变量：

```bash
# VS Code 打开
code .env

# 或用 nano/vim
nano .env
vim .env
```

### 第 3 步：根据你的部署方式选择配置

#### 🔧 本地开发环境

```ini
# .env
VITE_API_BASE=http://localhost:5000/api
VITE_WORKER_API=http://localhost:5000/api/workers
```

#### 🌐 同网络远程服务器

```ini
# .env
VITE_API_BASE=http://192.168.1.100:5000/api
VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

将 `192.168.1.100` 替换成你的**远程服务器实际 IP**。

#### 🔗 SSH 隧道转发

在本地终端运行：

```bash
ssh -L 5000:localhost:5000 user@remote-server.com
```

然后配置 `.env`：

```ini
# .env
VITE_API_BASE=http://localhost:5000/api
VITE_WORKER_API=http://localhost:5000/api/workers
```

#### 🏢 生产环境（Nginx 反向代理）

```ini
# .env
VITE_API_BASE=https://strategy.example.com/api
VITE_WORKER_API=https://strategy.example.com/api/workers
```

## 📝 完整配置示例

### 场景：远程服务器（192.168.1.100）

```ini
# .env - quantFinance Dashboard 项目根目录

# ============================================
# 远程服务器配置
# ============================================

# 后端 API 基础 URL
VITE_API_BASE=http://192.168.1.100:5000/api

# quant-strategy-manager Worker API
VITE_WORKER_API=http://192.168.1.100:5000/api/workers

# ============================================
# 可选配置
# ============================================

# 日志级别
VITE_LOG_LEVEL=debug

# 请求超时时间（毫秒）
VITE_REQUEST_TIMEOUT=30000
```

## 🔄 Vite 如何读取环境变量

在 Vue 组件中，使用 `import.meta.env` 来访问环境变量：

```javascript
// LiveStrategyLogs.vue

export default {
  data() {
    return {
      API_BASE: import.meta.env.VITE_API_BASE || '/api',
      apiWorkerUrl: import.meta.env.VITE_WORKER_API || '/api/workers'
    }
  }
}
```

**重要：只有以 `VITE_` 前缀开头的变量才会被 Vite 加载！**

## 🚀 使用配置

### 第 1 步：启动远程服务器

在远程服务器上：

```bash
# quant-strategy-manager
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python -m strategy_manager.cli start

# 另一个终端：Worker API 服务
python examples/api_with_log_streaming.py
```

### 第 2 步：配置本地 Dashboard

```bash
# 本地机器
cd /home/shuyolin/own/quantFinance-dashboard

# 编辑 .env 文件
nano .env
```

输入你的远程服务器 IP：

```ini
VITE_API_BASE=http://192.168.1.100:5000/api
VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

### 第 3 步：启动 Dashboard

```bash
# 本地机器
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`

## ✅ 验证配置是否生效

### 方法 1：浏览器控制台检查

打开 Dashboard，按 `F12` 打开开发者工具，在 Console 中运行：

```javascript
console.log(import.meta.env.VITE_API_BASE)
console.log(import.meta.env.VITE_WORKER_API)
```

应该看到你配置的 URLs。

### 方法 2：检查网络请求

在浏览器的 Network 标签中，看看请求是否发送到了正确的服务器。

### 方法 3：查看页面日志

打开 Dashboard 的 Live Logs 页面，如果成功连接应该会看到：
- ✅ "WebSocket connected for XXX"
- ✅ 实时日志流

## 🐛 常见问题

### Q1: 修改了 `.env` 后没有生效？

**A:** Vite 在启动时加载 `.env` 文件，如果修改了需要重启开发服务器：

```bash
# 停止当前的 npm run dev
# 然后重新运行
npm run dev
```

### Q2: 访问 `http://192.168.1.100:5000/api/workers` 返回 404？

**A:** 确认几件事：

1. API 服务器是否在运行？
   ```bash
   curl http://192.168.1.100:5000/api/workers
   ```

2. 防火墙是否允许访问？
   ```bash
   # 在远程服务器上
   sudo firewall-cmd --add-port=5000/tcp --permanent
   sudo firewall-cmd --reload
   ```

3. API 服务是否绑定到 `0.0.0.0`？
   ```python
   # 在 api_with_log_streaming.py 中
   app.run(host='0.0.0.0', port=5000)  # ← 必须是 0.0.0.0
   ```

### Q3: WebSocket 连接失败？

**A:** 检查以下项：

1. Worker 的端口是否开放？
   ```bash
   # 在本地机器上
   nc -zv 192.168.1.100 54321
   ```

2. Vite 的 proxy 配置是否正确？
   ```javascript
   // vite.config.mjs
   server: {
     proxy: {
       '/api': 'http://192.168.1.100:5000'  // 根据需要修改
     }
   }
   ```

## 📚 参考

- [Vite 环境变量文档](https://cn.vitejs.dev/guide/env-and-mode.html)
- [.env 文件安全性](https://cn.vitejs.dev/guide/env-and-mode.html#.env-files)

## 💡 最佳实践

1. **不要提交 `.env`** - 将 `.env` 添加到 `.gitignore`：
   ```bash
   echo ".env" >> .gitignore
   ```

2. **使用 `.env.example`** 作为模板：
   - 提交 `.env.example` 到版本控制
   - 在生产环境重命名或复制为 `.env`

3. **区分环境** - 创建不同的环境文件：
   - `.env` - 默认配置
   - `.env.local` - 本地开发（不提交）
   - `.env.production` - 生产配置

   然后使用：
   ```bash
   npm run build -- --mode production
   ```
