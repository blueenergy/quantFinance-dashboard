# Vue 组件 - 直接 WebSocket 连接指南

## 概述

`LiveStrategyLogs.vue` 已更新，现在支持**直接连接** `quant-strategy-manager` 的 Worker WebSocket 日志流，无需后端代理。

## 工作原理

```
┌────────────────────────────────────────────────────────┐
│  quantFinance Dashboard (Vue)                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LiveStrategyLogs.vue                            │  │
│  │  1. 获取 Worker API → 获取 WebSocket URL        │  │
│  │  2. 直接连接 Worker WebSocket                   │  │
│  │  3. 接收 JSON 日志流                             │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                        │
                        │ 直接 WebSocket 连接
                        ↓
┌────────────────────────────────────────────────────────┐
│  quant-strategy-manager (Remote Server)                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Worker[002050.SZ]                               │  │
│  │  LogStreamServer(ws://server:54321)              │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## 配置

### 1. 环境变量 (`.env`)

在 `quantFinance-dashboard` 的 `.env` 文件中添加：

```env
# 获取 Worker 列表和 WebSocket URL 的 API 端点
VITE_WORKER_API=http://remote-server:5000/api/workers

# 或者如果使用 Nginx 反向代理：
VITE_WORKER_API=https://strategy.example.com/api/workers
```

### 2. 组件配置 (LiveStrategyLogs.vue)

```javascript
data() {
  return {
    // ✅ 启用直接 WebSocket 连接（推荐）
    useDirectWebSocket: true,
    
    // 或者禁用回到后端代理方式
    useDirectWebSocket: false,
    
    // Worker API 地址
    apiWorkerUrl: import.meta.env.VITE_WORKER_API || '/api/workers'
  }
}
```

## 使用流程

### 步骤 1: 启动远程 quant-strategy-manager

```bash
# 在远程服务器上
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python -m strategy_manager.cli start
```

### 步骤 2: 提供 Worker API 端点

需要一个 REST API 来暴露 Workers 的信息和 WebSocket URLs。可以使用之前提供的 `api_with_log_streaming.py`：

```bash
# 在远程服务器上启动 API 服务器
python examples/api_with_log_streaming.py
```

API 应该返回格式：
```json
{
  "total_workers": 3,
  "workers": {
    "user123_002050.SZ_hidden_dragon": {
      "alive": true,
      "stats": {
        "symbol": "002050.SZ",
        "strategy": "hidden_dragon",
        "state": "running"
      },
      "log_stream_url": "ws://remote-server:54321"
    }
  }
}
```

### 步骤 3: 配置前端 .env

```env
VITE_API_BASE=http://remote-server:5000
VITE_WORKER_API=http://remote-server:5000/api/workers
```

### 步骤 4: 运行 Dashboard

```bash
cd /home/shuyolin/own/quantFinance-dashboard
npm install
npm run dev
```

## 关键修改说明

### 新增方法

#### `fetchWorkerWebSocketUrl()`
从 API 获取 Worker 的 WebSocket URL

```javascript
async fetchWorkerWebSocketUrl() {
  // 1. 调用 API 获取所有 Workers
  // 2. 查找匹配当前 symbol 的 Worker
  // 3. 获取其 log_stream_url
  // 4. 连接到该 WebSocket
}
```

#### `connectDirectWebSocket()`
直接连接到 Worker 的 WebSocket

```javascript
connectDirectWebSocket() {
  // 1. 创建 WebSocket 连接
  // 2. 处理来自 quant-strategy-manager 的日志格式
  // 3. 转换成 Vue 组件需要的格式
  // 4. 自动滚动、历史管理等
}
```

### 日志格式转换

从 `quant-strategy-manager` 接收的格式：
```json
{
  "timestamp": "2026-02-01T14:30:25.123456",
  "level": "INFO",
  "message": "Starting vnpy engine",
  "logger_name": "VnpyWorker[002050.SZ]",
  "module": "vnpy_adapter",
  "func_name": "run",
  "line_no": 95
}
```

Vue 组件内部格式：
```javascript
{
  timestamp: 1706790625.123,  // Unix 时间戳
  level: "INFO",
  message: "Starting vnpy engine",
  logger: "VnpyWorker[002050.SZ]",
  module: "vnpy_adapter"
}
```

## 远程访问场景

### 场景 1: 同网络 (推荐开发)

直接访问服务器 IP：

```env
VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

### 场景 2: SSH 隧道 (推荐开发)

```bash
# 在本地运行
ssh -L 5000:localhost:5000 -L 54321:localhost:54321 user@remote-server.com
```

```env
VITE_WORKER_API=http://localhost:5000/api/workers
```

### 场景 3: Nginx 反向代理 (推荐生产)

配置 Nginx 代理 WebSocket：

```nginx
upstream strategy_workers {
    server localhost:54321;
    server localhost:54322;
    server localhost:54323;
}

server {
    listen 443 ssl;
    server_name strategy.example.com;
    
    location /api/workers {
        proxy_pass http://localhost:5000;
    }
    
    location /ws/ {
        proxy_pass http://strategy_workers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

```env
VITE_WORKER_API=https://strategy.example.com/api/workers
```

## 故障排查

### 问题 1: WebSocket 连接失败

**症状:** 浏览器控制台显示 `Failed to fetch Worker WebSocket URL`

**检查项:**
1. 确保 API 服务器运行：`python examples/api_with_log_streaming.py`
2. 确保可以访问 API：`curl http://remote-server:5000/api/workers`
3. 检查防火墙是否阻止连接
4. 检查 CORS 配置

**解决方案:**
```javascript
// 添加 CORS 支持
from flask_cors import CORS
app = Flask(__name__)
CORS(app)  # 允许跨域
```

### 问题 2: 获不到 WebSocket URL

**症状:** 浏览器显示 `No Worker found for symbol 002050.SZ`

**检查项:**
1. Worker 是否真的在运行？
2. API 返回的 symbol 是否完全匹配？
3. 检查 API 响应的格式

**调试:**
```javascript
// 在 fetchWorkerWebSocketUrl() 中添加日志
console.log('Available workers:', Object.keys(workers));
console.log('Looking for symbol:', this.selectedSymbol);
```

### 问题 3: 日志显示格式错误

**症状:** 时间戳显示错误或消息混乱

**原因:** 日志格式转换问题

**解决方案:**
检查 `connectDirectWebSocket()` 中的日志格式转换：
```javascript
const logEntry = {
  timestamp: new Date(logData.timestamp).getTime() / 1000,  // 转成 Unix 时间戳
  level: logData.level,
  message: logData.message
}
```

## 后备方案 (降级到 API 代理)

如果直接 WebSocket 连接失败，组件会自动降级到后端 API 代理方式：

```javascript
if (foundWorker && foundWorker.log_stream_url) {
  // 使用直接 WebSocket
  this.connectDirectWebSocket()
} else {
  // 降级到 API 代理
  this.useDirectWebSocket = false
  this.connectWebSocket()  // 调用原来的方式
}
```

## 性能优化

### 1. 连接复用

不要创建多个 WebSocket 连接，使用单一连接：

```javascript
switchSymbol() {
  this.disconnectWebSocket()  // 先断开旧连接
  // ... 再创建新连接
}
```

### 2. 日志历史限制

保持最近 200 条日志，避免内存溢出：

```javascript
if (this.logHistory.length > 200) {
  this.logHistory.shift()  // 删除最古老的
}
```

### 3. 重连策略

自动重连，指数退避：

```javascript
attemptReconnect() {
  const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
}
```

## 总结

✅ **直接 WebSocket 连接优势：**
- 更低的延迟
- 不依赖后端中间代理
- 更简单的架构
- 更好的扩展性

✅ **支持多种部署方式：**
- 同网络直接连接
- SSH 隧道
- Nginx 反向代理
- API 网关

✅ **自动降级机制：**
- 如果直接连接失败，自动回到 API 代理
- 保证服务可用性
