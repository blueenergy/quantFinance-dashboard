# WebSocket 连接问题决策树

## 症状诊断流程

### 👉 我无法从前端访问 WebSocket

```
你看到什么错误？
│
├─ (A) "连接被拒绝" / "连接超时" / "无法连接"
│       ↓ [检查网络和端口]
│
├─ (B) "405 Method Not Allowed" / "404 Not Found" / "API 错误"
│       ↓ [检查 API 服务]
│
├─ (C) "CORS 错误"
│       ↓ [检查跨域配置]
│
├─ (D) "连接到 API 成功，但没有 WebSocket URL"
│       ↓ [检查 Worker 状态]
│
├─ (E) "有 WebSocket URL，但 WebSocket 连接失败"
│       ↓ [检查 WebSocket 端口]
│
└─ (F) "不确定出现了什么错误"
        ↓ [打开浏览器控制台 (F12 → Console)]
```

---

## 问题 A: 连接被拒绝 / 连接超时

### 表现：
- 网页显示"无法连接"
- 浏览器控制台显示：`ERR_CONNECTION_REFUSED` 或 `ERR_CONNECTION_TIMED_OUT`
- Curl 命令也超时：`curl http://192.168.1.100:5000/api/workers`

### 检查步骤：

#### ✅ 步骤 1: 验证服务器地址
```bash
# 在本地机器上
ping 192.168.1.100
```
- **能 ping 通** ✓ → 进入步骤 2
- **无法 ping 通** ✗ → 
  - 检查 IP 地址是否正确
  - 检查是否需要 VPN
  - 检查网络连接是否正常

#### ✅ 步骤 2: 检查 API 端口是否开放
```bash
# 在本地机器上（需要 nc/netcat）
nc -zv 192.168.1.100 5000

# 或用 curl
curl -v http://192.168.1.100:5000/api/workers
```
- **端口开放** ✓ → 进入步骤 3
- **端口未开放** ✗ → 在远程服务器检查：

```bash
# 在远程服务器上
netstat -tlnp | grep 5000
lsof -i :5000
```

如果看不到 `python` 或 `api_with_log_streaming.py`，说明 API 服务未启动：
```bash
# 启动 API 服务
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python examples/api_with_log_streaming.py
```

#### ✅ 步骤 3: 检查防火墙
```bash
# 在远程服务器上
sudo firewall-cmd --list-ports

# 如果 5000 不在列表中，添加它
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload
```

#### ✅ 步骤 4: 使用 SSH 隧道作为变通方案
如果防火墙无法修改，可以使用 SSH 隧道：
```bash
# 在本地机器上
ssh -L 5000:localhost:5000 user@remote-server.com

# 然后在 Dashboard 中使用
VITE_WORKER_API=http://localhost:5000/api/workers
```

---

## 问题 B: API 返回错误 (404 / 405 / 500)

### 表现：
- 浏览器显示 HTTP 错误代码（404, 405, 500 等）
- Curl 返回错误状态码

### 检查步骤：

#### ✅ 步骤 1: 检查 API 端点是否存在
```bash
# 测试基础路径
curl http://192.168.1.100:5000/
# 应该返回 JSON 响应

# 测试 /api/workers 端点
curl http://192.168.1.100:5000/api/workers
# 应该返回包含 workers 的 JSON
```

#### ✅ 步骤 2: 如果返回 404，检查路由定义
```bash
# 查看 API 代码中是否定义了该路由
grep -n "@app.route.*workers" /home/shuyolin/own/quant-strategy-manager/examples/api_with_log_streaming.py

# 应该看到类似：
# @app.route('/api/workers', methods=['GET'])
```

#### ✅ 步骤 3: 如果返回 500，查看 API 日志
```bash
# 在启动 API 的终端中查看错误信息
# 应该看到 Python traceback
```

#### ✅ 步骤 4: 重新启动 API 服务
```bash
# 停止现有的 API
pkill -f "api_with_log_streaming"

# 清理可能的缓存
rm -rf /tmp/api_cache* 2>/dev/null

# 重启 API
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python examples/api_with_log_streaming.py
```

---

## 问题 C: CORS 错误

### 表现：
浏览器控制台显示：
```
Access to XMLHttpRequest at 'http://192.168.1.100:5000/api/workers' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

### 解决方案：

#### ✅ 方案 1: 在 API 中启用 CORS（推荐）
修改 `examples/api_with_log_streaming.py`：
```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # ← 添加这一行

# 其他代码...
```

然后重启 API：
```bash
pkill -f "api_with_log_streaming"
python examples/api_with_log_streaming.py
```

#### ✅ 方案 2: 使用 Nginx 反向代理（开发环境）
创建 Nginx 配置，所有请求通过 Nginx 转发，避免 CORS 问题。

#### ✅ 方案 3: 检查开发环境配置
- 确保 Vue 开发服务器运行在 `localhost:5173`
- 如果换了端口，更新 API 的 CORS 配置

---

## 问题 D: API 返回成功，但没有 WebSocket URL

### 表现：
- API 返回 200 OK
- 但 response 中没有 `log_stream_url` 字段，或者 workers 为空

### 检查步骤：

#### ✅ 步骤 1: 检查 API 返回的数据结构
```bash
curl http://192.168.1.100:5000/api/workers | jq .

# 应该看到：
{
  "total_workers": 1,
  "workers": {
    "user123_002050.SZ_hidden_dragon": {
      "stats": {...},
      "log_stream_url": "ws://192.168.1.100:54321"
    }
  }
}
```

#### ✅ 步骤 2: 如果 workers 为空，启动 strategy_manager
```bash
# 在远程服务器上
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python -m strategy_manager.cli start

# 应该看到输出：
# ✅ Worker started: user123_002050.SZ_hidden_dragon
```

#### ✅ 步骤 3: 检查 strategy_manager 是否真的运行
```bash
# 在远程服务器上
ps aux | grep strategy_manager

# 应该看到 Python 进程
```

#### ✅ 步骤 4: 等待 Worker 启动
Worker 需要一些时间来启动，特别是第一次启动时。等待 30-60 秒后再次查询 API。

#### ✅ 步骤 5: 如果仍然无效，查看日志
```bash
# 查看 strategy_manager 日志
cat /home/shuyolin/own/quant-strategy-manager/logs/strategy_manager.log | tail -100

# 或在启动 strategy_manager 的终端查看实时日志
```

---

## 问题 E: WebSocket URL 存在，但 WebSocket 连接失败

### 表现：
- 浏览器能成功调用 API，获得 WebSocket URL（如 `ws://192.168.1.100:54321`）
- 但当尝试连接到这个 WebSocket 时失败
- 浏览器控制台显示：`WebSocket is closed with code 1000` 或连接超时

### 检查步骤：

#### ✅ 步骤 1: 检查 WebSocket 端口是否开放
从 API 返回的 URL 中找到端口号（例如 `54321`）：
```bash
# 在本地机器上
nc -zv 192.168.1.100 54321
```

- **端口开放** ✓ → 进入步骤 2
- **端口未开放** ✗ → 在远程服务器打开防火墙：

```bash
# 获取 Worker 的实际端口（可能不是 54321）
curl http://192.168.1.100:5000/api/workers | jq '.workers | .[] | .log_stream_url'

# 假设看到 ws://192.168.1.100:54321，则：
sudo firewall-cmd --add-port=54321/tcp --permanent
sudo firewall-cmd --reload

# 或批量打开一个范围
sudo firewall-cmd --add-port=54320-54330/tcp --permanent
sudo firewall-cmd --reload
```

#### ✅ 步骤 2: 验证 Worker 的 LogStreamServer 是否在运行
```bash
# 在远程服务器上
netstat -tlnp | grep -E "54[0-9]{3}"

# 应该看到类似
# tcp   LISTEN  54321/python
```

#### ✅ 步骤 3: 检查 WebSocket URL 格式
确保 API 返回的 URL 使用了正确的 IP（不是 `0.0.0.0` 或 `localhost`）：

```bash
# 检查返回的数据
curl http://192.168.1.100:5000/api/workers | jq '.workers | .[] | .log_stream_url'

# 结果应该是
# "ws://192.168.1.100:54321"  ✓

# 不应该是
# "ws://0.0.0.0:54321"  ✗
# "ws://localhost:54321"  ✗（除非本地访问）
```

如果是 `ws://0.0.0.0:54321`，需要修改 API 代码来替换 IP（见下面的"高级调试"）。

#### ✅ 步骤 4: 测试 WebSocket 连接
```bash
# 安装 websocat（如果没有）
# https://github.com/vi/websocat

# 或用 Python 测试
python3 << 'EOF'
import asyncio
import websockets

async def test_ws():
    try:
        async with websockets.connect("ws://192.168.1.100:54321") as ws:
            print("✓ WebSocket 连接成功")
            # 接收一条消息
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            print(f"✓ 收到消息: {msg[:100]}")
    except Exception as e:
        print(f"✗ 连接失败: {e}")

asyncio.run(test_ws())
EOF
```

#### ✅ 步骤 5: 检查 TLS/SSL（如果使用 HTTPS）
如果 API 使用 HTTPS，WebSocket 必须使用 WSS（`wss://`）：
```bash
# 如果 API 是 HTTPS
VITE_WORKER_API=https://192.168.1.100:5000/api/workers

# 则 WebSocket URL 应该是 wss://
# "wss://192.168.1.100:54321"
```

---

## 问题 F: 不确定是什么错误

### ✅ 快速诊断步骤：

#### 1. 打开浏览器控制台
按 `F12` 打开开发者工具，切换到 **Console** 标签，查看所有错误信息。

#### 2. 运行诊断工具
```bash
# 在远程服务器上
cd /home/shuyolin/own/quant-strategy-manager
chmod +x examples/quickcheck_websocket.sh
bash examples/quickcheck_websocket.sh 192.168.1.100 5000
```

#### 3. 打开网页诊断工具
在浏览器中打开：
```
file:///home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html
```

或在 Dashboard 运行时访问：
```
http://localhost:5173/diagnose_integrated.html
```

#### 4. 查看完整日志
```bash
# API 日志（在 API 启动终端）
# 应该能看到请求和错误

# Strategy Manager 日志
tail -f /home/shuyolin/own/quant-strategy-manager/logs/strategy_manager.log

# Worker 日志
tail -f /home/shuyolin/own/quant-strategy-manager/logs/worker_*.log
```

---

## 高级调试

### 修复 API 中的 0.0.0.0 问题

如果 API 返回 `ws://0.0.0.0:54321` 而不是正确的 IP，编辑 API：

```python
# examples/api_with_log_streaming.py

import socket
from flask import request

@app.route('/api/workers', methods=['GET'])
def list_workers():
    status = orchestrator.get_status()
    
    # 获取请求中的服务器 IP
    server_ip = request.host.split(':')[0]
    
    # 如果是 localhost，获取本机 IP
    if server_ip == 'localhost' or server_ip == '127.0.0.1':
        try:
            server_ip = socket.gethostbyname(socket.gethostname())
        except:
            server_ip = '127.0.0.1'
    
    workers = {}
    for key, worker_info in status['workers'].items():
        log_url = worker_info.get('log_stream_url', '')
        
        # 将 localhost 和 0.0.0.0 替换为实际 IP
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

### 启用详细日志

```python
# examples/api_with_log_streaming.py

# 在导入部分添加
import logging

# 设置详细日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

---

## 解决方案总结表

| 问题 | 症状 | 解决方案 |
|------|------|--------|
| 网络不通 | Ping 失败 | 检查 IP、网络、VPN |
| 端口被挡 | nc 超时 | 打开防火墙 |
| 服务未启 | 连接拒绝 | 启动 API 或 strategy_manager |
| API 路由错误 | 404 错误 | 检查 /api/workers 路由 |
| CORS 问题 | CORS 错误 | 在 API 中添加 CORS 支持 |
| Worker 未启 | 没有 WebSocket URL | 运行 `python -m strategy_manager.cli start` |
| WebSocket 端口被挡 | WebSocket 连接超时 | 打开 WebSocket 端口防火墙 |
| URL 格式错误 | WebSocket 连接失败 | 修复 API 中的 IP 替换逻辑 |
| TLS/SSL 问题 | 隐密连接错误 | 使用 WSS 而不是 WS |

---

## 常用命令参考

```bash
# 检查进程
ps aux | grep -E "(strategy_manager|api_with_log_streaming)"

# 杀死进程
pkill -f "api_with_log_streaming"
pkill -f "strategy_manager"

# 检查端口
netstat -tlnp | grep 5000
lsof -i :5000

# 测试连接
curl http://192.168.1.100:5000/api/workers
curl -v http://192.168.1.100:5000/api/workers  # 详细信息

# 打开防火墙
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --reload

# SSH 隧道
ssh -L 5000:localhost:5000 user@remote-server.com

# 查看日志
tail -f logs/api.log
tail -f logs/strategy_manager.log
```

---

## 需要帮助？

1. **运行诊断工具**：
   ```bash
   bash /home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh 192.168.1.100 5000
   ```

2. **打开网页诊断**：
   ```
   file:///home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html
   ```

3. **收集信息后告诉我**：
   - 诊断工具输出
   - 浏览器控制台错误
   - API 返回的数据
   - 进程运行状态

我将帮你进一步分析问题。
