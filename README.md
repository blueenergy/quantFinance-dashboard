# 悟空量化金融智能助手 — Dashboard

A股量化金融分析前端，基于 Vue 3 + Vuetify 3 + Vite 构建。  
配合 [quantFinance](https://github.com/blueenergy/quantFinance) FastAPI 后端使用。

## 功能模块

| 模块 | 说明 |
|------|------|
| **连板天梯** | 实时涨停梯队、情绪追踪、历史复盘 |
| **市场全景** | AI 大盘分析、市场情绪光谱、热门板块/概念 |
| **全球市场** | 美股/港股/外汇/大宗商品联动简报 |
| **热股分析** | 同花顺/东方财富热股榜 AI 点评 |
| **宏观分析** | 中国宏观（PMI/CPI/PPI/M2/LPR）与美联储利率深度分析 |
| **财报猎手** | 业绩预告/快报/卖方研报异动信号扫描 |
| **股票评分** | 六维量化评分（周期/价值/基本面/成长/技术/资金），支持沪深300、中证500等主流指数 |
| **深度分析** | LLM 驱动的单股深度研究，含技术面、筹码、投资建议、止损止盈参考 |
| **自选股** | 个人自选股管理、评分排行、历史分析记录 |
| **策略工作台** | 策略 Worker 监控、回测管理、执行分析 |
| **行情图表** | K线对比、ETF 走势、申万行业指数 |
| **日志中心** | 实时策略日志查看器（WebSocket 推送） |
| **管理后台** | 用户管理、权限矩阵、数据采集监控 |

## 技术栈

- **框架**：Vue 3 (Composition API) + Vuetify 3
- **构建**：Vite 7 + vite-plugin-compression
- **图表**：ECharts 6 + Vue Flow（DAG 流程图）
- **HTTP**：Axios
- **测试**：Vitest + @vue/test-utils + Happy DOM
- **容器**：Docker 多阶段构建（Rocky Linux 9 + Nginx）

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

环境变量配置：

```bash
cp .env.example .env
# 默认指向 http://localhost:3001 的 quantFinance 后端
# 如需修改，编辑 .env 中的 VITE_API_BASE
```

### 构建生产包

```bash
npm run build
# 产物输出至 dist/
```

### Docker 部署

```bash
# 构建镜像
docker build -t quant-dashboard .

# 运行容器（需与后端同网络）
docker run -d \
  -p 80:80 \
  -e VITE_API_BASE=http://your-backend:3001/api \
  --name quant-dashboard \
  quant-dashboard
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_API_BASE` | `/api` | FastAPI 后端根路径 |
| `VITE_WORKER_API` | `/api/strategy/workers` | 策略 Worker API 路径 |

详见 [docs/ENV_CONFIGURATION.md](docs/ENV_CONFIGURATION.md)。

## 后端依赖

需配合 **quantFinance** FastAPI 后端（默认端口 3001）运行，主要接口包括：
- `/api/hermes-tools/*` — MCP 工具端点（量化数据、AI 分析）
- `/api/user/*` — 用户认证与自选股管理
- `/api/strategy/*` — 策略工作台
- WebSocket `/ws/logs` — 实时日志推送

## 项目结构

```
src/
├── api/          # Axios 请求封装
├── components/   # 可复用 UI 组件（图表、对话框、卡片等）
├── composables/  # Vue 组合式逻辑（WebSocket、认证状态等）
├── services/     # 业务服务层
├── views/        # 页面级视图（天梯、宏观、ETF 等）
├── theme/        # Vuetify 主题与设计 token
└── utils/        # 工具函数
```

## 测试

```bash
npm run test
```

## License

Private — © blueenergy
