# quantFinance Dashboard - WebSocket 连接配置（简化版）

## 🎯 三种配置方式（选一种即可）

### 方式 1️⃣：使用 .env 文件（推荐）

**步骤：**

1. 在项目根目录编辑 `.env` 文件：

```bash
nano /home/shuyolin/own/quantFinance-dashboard/.env
```

2. 添加你的远程服务器 URL（替换为你的实际 IP）：

```ini
VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

3. 保存后重启 `npm run dev`

✅ **优点：** 可以配置不同服务器，生产环境友好  
❌ **缺点：** 需要创建 `.env` 文件

---

### 方式 2️⃣：代码硬编码（快速调试）

1. 编辑 `src/components/LiveStrategyLogs.vue`：

```bash
nano /home/shuyolin/own/quantFinance-dashboard/src/components/LiveStrategyLogs.vue
```

2. 找到这一行（大约第 135 行）：

```javascript
const hardcodedUrl = null  // 改为你的 URL 字符串来硬编码
```

3. 改为：

```javascript
const hardcodedUrl = 'http://192.168.1.100:5000/api/workers'
```

4. 保存，自动热更新（或重启 `npm run dev`）

✅ **优点：** 快速生效，不需要 .env 文件  
❌ **缺点：** 修改代码，容易误提交

---

### 方式 3️⃣：后端代理（无需配置）

什么都不改，直接使用项目现有的 API 代理。

需要后端 API 支持 `/api/workers` 端点。

✅ **优点：** 无需配置  
❌ **缺点：** 需要修改现有后端 API

---

## 🚀 快速开始（推荐：方式 1）

### 第 1 步：编辑 .env 文件

```bash
cd /home/shuyolin/own/quantFinance-dashboard

# 打开 .env 编辑
nano .env
```

### 第 2 步：输入你的配置

假设远程服务器 IP 是 `192.168.1.100`，输入：

```ini
VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

按 `Ctrl+O` → `Enter` → `Ctrl+X` 保存退出。

### 第 3 步：重启开发服务器

```bash
# 停止当前的 npm run dev（如果在运行）
# 然后重新运行
npm run dev
```

### 第 4 步：验证

打开 Dashboard，按 `F12` 打开控制台，应该看到：

```
✅ Using VITE_WORKER_API from .env: http://192.168.1.100:5000/api/workers
```

完成！✨

---

## 📍 IP 地址怎么填？

### 查询远程服务器 IP

在远程服务器上运行：

```bash
hostname -I
# 或
ip addr | grep "inet "
```

看起来像这样的地址：`192.168.1.100` 或 `10.0.0.5`

### 不同网络场景

| 场景 | IP 地址 | 例子 |
|------|--------|------|
| 同网络（内网） | 服务器内网 IP | `192.168.1.100` |
| 外网访问 | 服务器公网 IP | `1.2.3.4` |
| SSH 隧道 | `localhost` | `http://localhost:5000/api/workers` |

---

## ✅ 验证配置是否生效

### 方法 1：浏览器控制台

1. 打开 Dashboard（`http://localhost:5173`）
2. 按 `F12` 打开开发者工具 → Console 标签
3. 查看是否有日志显示配置成功

```
✅ Using VITE_WORKER_API from .env: http://192.168.1.100:5000/api/workers
```

### 方法 2：测试 API 连接

在本地机器终端运行：

```bash
# 测试能否访问 API
curl http://192.168.1.100:5000/api/workers

# 应该返回类似这样的 JSON
# {"total_workers": 3, "workers": {...}}
```

### 方法 3：查看日志流

在 Dashboard 中：
1. 选择一个 Symbol
2. 如果看到 "✅ Direct WebSocket connected" 说明成功了！

---

## 🛠️ 为什么需要这个配置？

| 部分 | 作用 |
|------|------|
| `VITE_WORKER_API` | 告诉 Dashboard 去哪个服务器获取 Worker 信息 |
| Worker 信息包含 | WebSocket URL（日志流地址） |
| 日志流 | 实时查看策略运行日志 |

---

## 💡 总结

**最简单的方式：**

```bash
# 1. 编辑 .env
nano /home/shuyolin/own/quantFinance-dashboard/.env

# 2. 添加一行（改成你的服务器 IP）
VITE_WORKER_API=http://192.168.1.100:5000/api/workers

# 3. 保存（Ctrl+O, Enter, Ctrl+X）

# 4. 重启
npm run dev
```

完成！✨

有问题可以查看完整的配置指南：[ENV_CONFIGURATION.md](./ENV_CONFIGURATION.md)
