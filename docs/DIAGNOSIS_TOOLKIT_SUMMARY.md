# WebSocket 诊断工具总结

你现在有了完整的诊断工具套件，可以系统地排查 WebSocket 连接问题。

## 📦 可用工具一览

### 1. **快速检查脚本** (Shell)
📍 位置：`/home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh`

```bash
chmod +x /home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh
bash /home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh 192.168.1.100 5000
```

✅ 检查内容：
- 网络连接（ping）
- API 端口是否开放
- API 响应是否正常
- WebSocket 端口状态
- 防火墙配置

⏱️ 运行时间：2-5 秒

### 2. **集成诊断工具** (网页)
📍 位置：`/home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html`

在浏览器中打开：
```
file:///home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html
```

✅ 检查内容：
- 网络连接
- API 响应格式
- Worker 信息
- WebSocket URL 验证
- WebSocket 连接测试（浏览器级别）

⏱️ 运行时间：5-10 秒

### 3. **完整故障排查指南**
📍 位置：`/home/shuyolin/own/quantFinance-dashboard/docs/TROUBLESHOOT_WEBSOCKET.md`

详细的步骤式故障排查，包括：
- 常见症状和对应的解决方案
- 每个步骤的具体命令
- CORS 错误处理
- SSH 隧道配置
- 防火墙配置

### 4. **决策树**
📍 位置：`/home/shuyolin/own/quantFinance-dashboard/docs/DECISION_TREE.md`

完整的诊断流程图，帮你快速定位问题。

### 5. **快速开始指南**
📍 位置：`/home/shuyolin/own/quantFinance-dashboard/docs/QUICKSTART_DIAGNOSIS.md`

三步诊断流程 + 常见情况快速解决方案。

---

## 🚀 使用流程

### **第一阶段：快速检查**（2-5 分钟）

**步骤 1：在远程服务器上运行脚本**
```bash
ssh user@192.168.1.100
cd /home/shuyolin/own/quant-strategy-manager
bash examples/quickcheck_websocket.sh 192.168.1.100 5000
```

**步骤 2：记录输出结果**
- 哪些检查通过了？
- 哪些检查失败了？

### **第二阶段：网页诊断**（3-5 分钟）

**步骤 1：打开诊断工具**
```
file:///home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html
```

**步骤 2：输入你的 API 地址**
```
http://192.168.1.100:5000/api/workers
```

**步骤 3：点击"开始诊断"**
等待所有检查完成，查看详细结果。

### **第三阶段：根据结果采取行动**（5-15 分钟）

根据诊断结果：

| 问题 | 参考文档 |
|------|--------|
| 网络连接失败 | [DECISION_TREE.md - 问题 A](DECISION_TREE.md#问题-a-连接被拒绝--连接超时) |
| API 错误 | [DECISION_TREE.md - 问题 B](DECISION_TREE.md#问题-b-api-返回错误-404--405--500) |
| CORS 错误 | [DECISION_TREE.md - 问题 C](DECISION_TREE.md#问题-c-cors-错误) |
| 没有 Worker | [DECISION_TREE.md - 问题 D](DECISION_TREE.md#问题-d-api-返回成功但没有-websocket-url) |
| WebSocket 连接失败 | [DECISION_TREE.md - 问题 E](DECISION_TREE.md#问题-e-websocket-url-存在但-websocket-连接失败) |

---

## 📊 诊断工具对比

| 工具 | 检查项目 | 需要网络 | 使用难度 | 最佳场景 |
|------|--------|--------|--------|--------|
| 快速检查脚本 | 基础网络和端口 | 是 | 简单 | 初步诊断 |
| 网页诊断 | 完整 API 和 WebSocket | 是 | 简单 | 详细诊断 |
| 浏览器控制台 | JavaScript 错误 | 是 | 中等 | 前端问题 |
| 故障排查指南 | 所有情况 | 否 | 中等 | 深度分析 |
| 决策树 | 流程指导 | 否 | 简单 | 快速定位 |

---

## 🎯 常见场景快速解决

### 场景 1：完全无法连接
```bash
# 1. 运行快速检查
bash /home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh 192.168.1.100 5000

# 2. 如果网络不通
ping 192.168.1.100

# 3. 如果端口无法连接
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload
```

### 场景 2：能连接 API，但没有 WebSocket
```bash
# 1. 检查 strategy_manager 是否运行
ps aux | grep strategy_manager

# 2. 如果没有运行，启动它
python -m strategy_manager.cli start

# 3. 等待 Worker 启动（30-60 秒）

# 4. 重新查询 API
curl http://192.168.1.100:5000/api/workers
```

### 场景 3：能连接 API，但 WebSocket 连接失败
```bash
# 1. 检查 WebSocket URL 格式
curl http://192.168.1.100:5000/api/workers | jq '.workers | .[] | .log_stream_url'

# 2. 如果是 0.0.0.0，修复 API（见下面的代码）

# 3. 如果格式正确，打开防火墙
WSPORT=54321  # 替换为实际端口
sudo firewall-cmd --add-port=$WSPORT/tcp --permanent
sudo firewall-cmd --reload
```

### 场景 4：CORS 错误
```python
# 编辑 /home/shuyolin/own/quant-strategy-manager/examples/api_with_log_streaming.py

from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # ← 添加这行

# 然后重启 API
```

---

## 📝 常用命令速查

```bash
# ===== 网络诊断 =====
ping 192.168.1.100
curl http://192.168.1.100:5000/api/workers
curl -v http://192.168.1.100:5000/api/workers  # 详细信息

# ===== 端口检查 =====
netstat -tlnp | grep 5000
lsof -i :5000
nc -zv 192.168.1.100 5000

# ===== 防火墙 =====
sudo firewall-cmd --list-ports
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --add-port=54320-54330/tcp --permanent
sudo firewall-cmd --reload

# ===== 进程管理 =====
ps aux | grep -E "(strategy_manager|api_with_log_streaming)"
pkill -f "api_with_log_streaming"
pkill -f "strategy_manager"

# ===== 日志查看 =====
tail -f /home/shuyolin/own/quant-strategy-manager/logs/strategy_manager.log
tail -f /home/shuyolin/own/quant-strategy-manager/logs/api.log

# ===== 服务启动 =====
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python examples/api_with_log_streaming.py
python -m strategy_manager.cli start

# ===== 环境变量配置 =====
cd /home/shuyolin/own/quantFinance-dashboard
nano .env
# 设置：VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

---

## ✅ 诊断检查清单

按顺序检查以下项目：

- [ ] **网络连接** - 能 ping 通目标服务器吗？
  ```bash
  ping 192.168.1.100
  ```

- [ ] **API 端口开放** - 能连接到 API 端口吗？
  ```bash
  nc -zv 192.168.1.100 5000
  ```

- [ ] **API 响应正常** - API 返回 200 状态码吗？
  ```bash
  curl http://192.168.1.100:5000/api/workers
  ```

- [ ] **Worker 正在运行** - API 返回中有 Worker 信息吗？
  ```bash
  ps aux | grep strategy_manager
  ```

- [ ] **WebSocket URL 存在** - API 返回中有 `log_stream_url` 吗？
  ```bash
  curl http://192.168.1.100:5000/api/workers | jq '.workers | .[] | .log_stream_url'
  ```

- [ ] **WebSocket 端口开放** - 能连接到 WebSocket 端口吗？
  ```bash
  nc -zv 192.168.1.100 54321
  ```

- [ ] **Dashboard 配置正确** - `.env` 中的 `VITE_WORKER_API` 正确吗？
  ```bash
  cat /home/shuyolin/own/quantFinance-dashboard/.env
  ```

- [ ] **浏览器控制台无错误** - 按 F12 检查 Console
  ```
  查看是否有网络错误、CORS 错误或其他 JavaScript 错误
  ```

---

## 🔧 API 代码修复参考

### 修复 0.0.0.0 问题

如果 API 返回 `ws://0.0.0.0:54321` 而不是 `ws://192.168.1.100:54321`：

```python
# /home/shuyolin/own/quant-strategy-manager/examples/api_with_log_streaming.py

import socket
from flask import request

@app.route('/api/workers', methods=['GET'])
def list_workers():
    status = orchestrator.get_status()
    
    # 获取请求中的服务器 IP
    server_ip = request.host.split(':')[0]
    
    # 如果是 localhost，获取本机 IP
    if server_ip in ('localhost', '127.0.0.1', '0.0.0.0'):
        try:
            # 获取实际的服务器 IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            server_ip = s.getsockname()[0]
            s.close()
        except:
            server_ip = '127.0.0.1'
    
    workers = {}
    for key, worker_info in status['workers'].items():
        log_url = worker_info.get('log_stream_url', '')
        
        # 替换 IP
        if log_url:
            log_url = log_url.replace('0.0.0.0', server_ip)
            log_url = log_url.replace('localhost', server_ip)
        
        workers[key] = {
            'stats': worker_info.get('stats', {}),
            'log_stream_url': log_url
        }
    
    return jsonify({
        'total_workers': len(workers),
        'workers': workers
    })
```

### 添加 CORS 支持

```python
# /home/shuyolin/own/quant-strategy-manager/examples/api_with_log_streaming.py

from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 添加这一行

# 其他代码...
```

---

## 📞 何时需要帮助

如果诊断工具无法解决问题，请收集以下信息：

1. **诊断工具输出**
   ```bash
   bash /home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh 192.168.1.100 5000
   ```
   复制所有输出

2. **网页诊断结果**
   - 截图或复制结果

3. **浏览器控制台错误**
   - F12 → Console → 复制所有错误

4. **API 响应**
   ```bash
   curl http://192.168.1.100:5000/api/workers | jq .
   ```
   复制完整的 JSON 输出

5. **进程状态**
   ```bash
   ps aux | grep -E "(python|strategy_manager|api_with_log_streaming)"
   ```
   复制输出

6. **防火墙状态**
   ```bash
   sudo firewall-cmd --list-ports
   ```
   复制输出

---

## 📚 文档导航

- 🚀 **快速开始** → [QUICKSTART_DIAGNOSIS.md](QUICKSTART_DIAGNOSIS.md)
- 🔧 **详细故障排查** → [TROUBLESHOOT_WEBSOCKET.md](TROUBLESHOOT_WEBSOCKET.md)
- 🌳 **完整决策树** → [DECISION_TREE.md](DECISION_TREE.md)
- ⚙️ **环境配置** → [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md)
- 📖 **WebSocket 集成** → [WEBSOCKET_DIRECT_CONNECTION.md](WEBSOCKET_DIRECT_CONNECTION.md)

---

**现在你已准备好进行系统的 WebSocket 诊断！** 🎯

从 [QUICKSTART_DIAGNOSIS.md](QUICKSTART_DIAGNOSIS.md) 开始，按步骤进行。
