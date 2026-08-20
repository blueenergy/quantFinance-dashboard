# Dashboard：Worker 列表与实时日志 WebSocket 排障

> 架构背景见 llm-wiki `projects/trading/strategy-worker-websocket-architecture.md`。  
> 后端 proxy / `REMOTE_WORKER_API` 见 `quantFinance/docs/WEBSOCKET_REALTIME_LOG_TROUBLESHOOTING.md`。

## 数据流（当前实现）

```text
Dashboard (StrategyWorkers Tab / log-viewer.html)
  → GET {VITE_WORKER_API}  （默认 /api/strategy/workers，需 JWT）
  → quantFinance :3001 代理 → quant-strategy-manager :5000
  → 响应含 log_stream_url
  → 浏览器 WebSocket 直连 Worker（生产常经 Nginx /ws/{port}）
```

组件：`StrategyWorkers.vue`（列表）、`LogViewer.vue`（经 `log-viewer.html?ws=…` 打开）。  
**不存在** `LiveStrategyLogs.vue`（旧文档已废弃）。

## 环境变量

复制 `.env.example` → `.env`：

| 变量 | 本地 dev 默认 | 说明 |
|------|---------------|------|
| `VITE_API_BASE` | `/api` | quantFinance REST；vite 代理到 `localhost:3001` |
| `VITE_WORKER_API` | `/api/strategy/workers` | Worker 列表；**不要**写成 `:5000/api/workers`，除非绕过 quantFinance 直连 manager |

远程示例（同网段）：

```bash
VITE_API_BASE=http://192.168.1.100:3001/api
VITE_WORKER_API=http://192.168.1.100:3001/api/strategy/workers
```

SSH 隧道：

```bash
ssh -L 3001:localhost:3001 user@remote
# .env 仍用 localhost:3001
```

**注意**：`vite.config.mjs` 的 dev proxy 固定 `/api → localhost:3001`。改 `.env` 为绝对 URL 时，请求**不再走 proxy**，需确保目标可达且 CORS/鉴权正确。

## 快速检查（2 分钟）

```bash
# 1. 集成脚本（trading 根目录）
bash /home/shuyolin/trading/check_websocket_integration.sh

# 2. quantFinance 侧 remote manager
bash /home/shuyolin/trading/quantFinance/check_remote_strategy_manager.sh

# 3. Worker API（需有效 JWT）
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/strategy/workers | jq .

# 4. strategy-manager 直连（在 manager 机器上）
curl -s http://localhost:5000/api/workers | jq .
```

期望：`total_workers > 0` 且 alive worker 带 `log_stream_url`。

## 浏览器诊断页（可选）

```text
file:///home/shuyolin/trading/quantFinance-dashboard/diagnose_integrated.html
# 或 npm run dev 后
http://localhost:5173/diagnose_integrated.html
```

输入 **quantFinance 代理地址**，例如 `http://localhost:3001/api/strategy/workers`（不是裸 `:5000`，除非刻意直连 manager）。

Shell 快速检查（strategy-manager 仓库）：

```bash
bash /home/shuyolin/trading/quant-strategy-manager/examples/quickcheck_websocket.sh localhost 5000
```

## 症状 → 处理

| 症状 | 先查 |
|------|------|
| Worker 列表 401/403 | 登录 Dashboard；`access_token` 是否有效 |
| Worker 列表 502/连接失败 | quantFinance 是否运行；`.env` 里 `REMOTE_WORKER_API` 是否指向 `:5000/api/workers` |
| 列表空 / 0 workers | strategy-manager 是否启动；Mongo `watchlist_strategies` 是否有配置 |
| 有 URL 但 WS 失败 | 防火墙 / Nginx `/ws/`；URL 含 `0.0.0.0` → 组件会自动替换为当前 hostname |
| CORS（绝对 URL 跨域） | 改回相对路径 `/api/...` 走 vite/nginx 同源代理 |
| 生产 wss 失败 | manager 的 `USE_NGINX_WEBSOCKET`、`PUBLIC_HOST`、`USE_HTTPS` |

## 日志路径

- **实时**：Strategy Workers →「实时日志」→ `log-viewer.html`
- **历史**：同页「历史日志」→ quantFinance `/api/strategy/workers/{key}/logs`

## 关联

- [[projects/trading/worker-logging-guide|Worker 日志指南]]（llm-wiki）
- [[projects/trading/worker-deployment-modes|部署模式]]（同机 / 分机）
