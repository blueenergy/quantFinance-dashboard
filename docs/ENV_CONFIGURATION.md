# 环境变量（Dashboard）

完整说明见项目根目录 **`.env.example`**。WebSocket / Worker 排障见 [WEBSOCKET_TROUBLESHOOTING.md](./WEBSOCKET_TROUBLESHOOTING.md)。

## 必填（本地开发）

```bash
cp .env.example .env
```

| 变量 | 推荐值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | `/api` | 由 Vite 代理到 quantFinance `:3001` |
| `VITE_WORKER_API` | `/api/strategy/workers` | 经 quantFinance 代理到 strategy-manager |

## 可选

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_LOG_LEVEL` | — | 前端日志级别 |
| `VITE_REQUEST_TIMEOUT` | 代码内 30s | 见 `src/api/request.js` |
| `VITE_ASSISTANT_STREAM_BACKEND` | `legacy` | `hermes` = 经 quant-api BFF |

## 远程 / 生产

使用 **quantFinance 对外 URL**（含 `/api`），不要只配 strategy-manager `:5000`，否则 JWT 与 CORS 易错。示例见 `.env.example` 注释。
