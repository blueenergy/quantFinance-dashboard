# WebSocket 连接故障排查指南

## 🔍 快速诊断步骤

### 第 1 步：打开诊断工具

在浏览器中打开：
```
file:///home/shuyolin/own/quantFinance-dashboard/diagnose_websocket.html
```

或在 quantFinance-dashboard 运行时访问：
```
http://localhost:5173/diagnose_websocket.html
```

然后输入你的 API 服务器地址（例如 `http://192.168.1.100:5000/api/workers`）点击"开始诊断"。

### 第 2 步：在远程服务器上运行诊断脚本

```bash
cd /home/shuyolin/own/quant-strategy-manager
chmod +x examples/diagnose_websocket.sh

# 在远程服务器本地运行（检查自己是否正常）
bash examples/diagnose_websocket.sh localhost 5000

# 或指定本地 IP
bash examples/diagnose_websocket.sh 192.168.1.100 5000
```

### 第 3 步：检查浏览器控制台

在 Dashboard 页面按 `F12` 打开开发者工具，切换到 Console 标签，查看是否有错误日志。

---

## 📋 完整诊断清单

### 🔴 症状 1: "连接超时" 或 "无法连接"

**可能原因：** 网络不通或防火墙阻止

**排查步骤：**

1. **检查网络连接**
   ```bash
   # 在本地机器上
   ping 192.168.1.100
   ```
   
   ✅ 如果 ping 通了，进入第 2 步  
   ❌ 如果 ping 不通，检查：
   - 服务器 IP 地址是否正确？
   - 两台机器是否在同一网络？
   - 是否需要 VPN？

2. **检查 API 端口是否开放**
   ```bash
   # 在本地机器上（需要安装 netcat）
   nc -zv 192.168.1.100 5000
   
   # 或用 curl
   curl -v http://192.168.1.100:5000/api/workers
   ```
   
   ✅ 如果收到响应，进入第 3 步  
   ❌ 如果超时，在远程服务器检查：
   ```bash
   # 在远程服务器上
   netstat -tlnp | grep 5000
   # 或
   lsof -i :5000
   ```
   
   如果看不到 `python` 或 `api_with_log_streaming.py`，说明服务未启动：
   ```bash
   # 启动 API 服务
   cd /home/shuyolin/own/quant-strategy-manager
   source .venv/bin/activate
   python examples/api_with_log_streaming.py
   ```

3. **检查防火墙**
   
   ```bash
   # 在远程服务器上，如果使用 firewalld
   sudo firewall-cmd --list-ports
   
   # 如果 5000 没有列出，添加它
   sudo firewall-cmd --add-port=5000/tcp --permanent
   sudo firewall-cmd --reload
   
   # 检查 WebSocket 端口（54321 是示例，实际端口动态分配）
   sudo firewall-cmd --add-port=54321/tcp --permanent
   sudo firewall-cmd --reload
   ```

---

### 🔴 症状 2: "API 返回 404"

**可能原因：** API 端点不存在或路由错误

**排查步骤：**

1. **检查 API 服务是否真的在运行**
   ```bash
   curl http://192.168.1.100:5000/
   ```
   
   应该返回类似：`{"message": "Strategy Manager API", ...}`

2. **检查端点是否正确**
   ```bash
   curl http://192.168.1.100:5000/api/workers
   ```
   
   应该返回：
   ```json
   {
     "total_workers": 3,
     "workers": {...}
   }
   ```

3. **如果返回 404，检查 API 代码**
   ```bash
   # 查看 api_with_log_streaming.py 是否有 /api/workers 路由
   grep -n "def list_workers" /home/shuyolin/own/quant-strategy-manager/examples/api_with_log_streaming.py
   
   grep -n "@app.route.*workers" /home/shuyolin/own/quant-strategy-manager/examples/api_with_log_streaming.py
   ```

---

### 🔴 症状 3: "API 返回 CORS 错误"

**可能原因：** 跨域请求被阻止

**检查浏览器控制台，看是否有类似错误：**
```
Access to XMLHttpRequest at 'http://192.168.1.100:5000/api/workers' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**解决方案：**

修改 `examples/api_with_log_streaming.py`：

```python
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # ← 添加这一行

# 其他代码...
```

然后重启 API 服务。

---

### 🔴 症状 4: "拿到了 API 响应，但没有 WebSocket URL"

**可能原因：** Worker 还没有启动

**排查步骤：**

1. **检查是否有 Worker 在运行**
   ```bash
   # 在远程服务器上
   python -m strategy_manager.cli status
   
   # 或查看返回的 API 数据
   curl http://192.168.1.100:5000/api/workers | jq .workers
   ```
   
   如果 `workers` 为空或没有 `log_stream_url` 字段，需要启动 Worker：
   
   ```bash
   # 启动 strategy_manager
   python -m strategy_manager.cli start
   ```

2. **等待 Worker 启动**
   
   Worker 需要一段时间启动。查看日志：
   ```bash
   # 在启动 strategy_manager 的终端中应该看到
   ✅ Worker started: user123_002050.SZ_hidden_dragon
   ```

---

### 🔴 症状 5: "前端能连接 API，但 WebSocket 连接超时"

**可能原因：** WebSocket 端口被防火墙阻止或未启动

**排查步骤：**

1. **检查 WebSocket 端口是否开放**
   
   从浏览器控制台得到的 WebSocket URL，例如 `ws://192.168.1.100:54321`
   
   ```bash
   # 在本地机器上测试
   nc -zv 192.168.1.100 54321
   ```
   
   如果超时，在远程服务器打开防火墙：
   ```bash
   # 打开所有 WebSocket 端口（54320-54330）
   sudo firewall-cmd --add-port=54320-54330/tcp --permanent
   sudo firewall-cmd --reload
   ```

2. **检查 Worker 日志**
   
   在启动 strategy_manager 的终端中查看是否有错误：
   ```
   Log stream server started on ws://0.0.0.0:54321
   ```

3. **如果端口看起来是 `ws://0.0.0.0:54321` 但无法连接**
   
   这说明 URL 还没有被替换成实际的服务器 IP。检查 API 返回的数据：
   ```bash
   curl http://192.168.1.100:5000/api/workers | jq '.workers | .[0].log_stream_url'
   
   # 应该看到 ws://192.168.1.100:54321 而不是 ws://0.0.0.0:54321
   ```
   
   如果是 `ws://0.0.0.0:54321`，需要修改 API 代码来替换 IP（见下面的高级调试）。

---

## 🔧 高级调试

### 检查 API 返回的数据结构

```bash
# 在远程服务器上
curl http://192.168.1.100:5000/api/workers | jq .

# 应该返回类似这样的结构
{
  "total_workers": 1,
  "workers": {
    "user123_002050.SZ_hidden_dragon": {
      "alive": true,
      "stats": {
        "symbol": "002050.SZ",
        "strategy": "hidden_dragon",
        "state": "running"
      },
      "log_stream_url": "ws://192.168.1.100:54321"
    }
  }
}
```

### 修复 API 中的 IP 替换

如果 API 返回的 URL 是 `ws://0.0.0.0:54321` 而不是正确的服务器 IP，编辑 API 代码：

```python
# examples/api_with_log_streaming.py

@app.route('/api/workers', methods=['GET'])
def list_workers():
    status = orchestrator.get_status()
    
    # 获取请求中的服务器 IP
    server_ip = request.host.split(':')[0]
    if server_ip == 'localhost' or server_ip == '127.0.0.1':
        server_ip = socket.gethostbyname(socket.gethostname())  # 获取本机 IP
    
    workers = {}
    for key, worker_info in status['workers'].items():
        log_url = worker_info.get('log_stream_url', '')
        
        # 将 localhost 和 0.0.0.0 替换为实际 IP
        if 'localhost' in log_url or '0.0.0.0' in log_url:
            log_url = log_url.replace('localhost', server_ip).replace('0.0.0.0', server_ip)
        
        workers[key] = {
            'stats': worker_info['stats'],
            'log_stream_url': log_url
        }
    
    return jsonify({
        'total_workers': len(workers),
        'workers': workers
    })
```

### 查看完整的日志

```bash
# 在远程服务器上运行 quant-strategy-manager，查看所有日志
python -m strategy_manager.cli start --log-level DEBUG

# 在本地 Dashboard 控制台也会输出诊断日志
# 按 F12 → Console 查看
```

---

## 📊 完整诊断流程图

```
前端无法访问 WebSocket
  ↓
[运行诊断工具]
  ↓
[检查网络连接] → ping 通？
  ├─ 否 → 检查 IP、防火墙、VPN
  └─ 是 ↓
  
[检查 API 端口] → 5000 开放？
  ├─ 否 → 检查防火墙、启动服务
  └─ 是 ↓
  
[检查 API 响应] → 返回 200？
  ├─ 否 → 检查 API 路由、CORS
  └─ 是 ↓
  
[检查 WebSocket URLs] → 有 URLs？
  ├─ 否 → 启动 Worker
  └─ 是 ↓
  
[检查 WebSocket 端口] → 端口开放？
  ├─ 否 → 打开防火墙
  └─ 是 ↓
  
[测试 WebSocket 连接] → 成功？
  ├─ 否 → 检查 URL 格式、协议版本
  └─ 是 ✅ 连接成功！
```

---

## 💡 常见解决方案

### 快速开放所有必要端口

```bash
# 在远程服务器上
sudo firewall-cmd --add-port=5000/tcp --permanent  # API
sudo firewall-cmd --add-port=8000/tcp --permanent  # FastAPI
sudo firewall-cmd --add-port=8001/tcp --permanent  # Mobile API
sudo firewall-cmd --add-port=54320-54330/tcp --permanent  # WebSocket
sudo firewall-cmd --reload

# 验证
sudo firewall-cmd --list-ports
```

### 重启所有服务

```bash
# 在远程服务器上

# 1. 停止现有服务
pkill -f "strategy_manager"
pkill -f "api_with_log_streaming"

# 2. 启动 quant-strategy-manager
cd /home/shuyolin/own/quant-strategy-manager
source .venv/bin/activate
python -m strategy_manager.cli start &

# 3. 启动 API 服务（另一个终端）
python examples/api_with_log_streaming.py &

# 4. 验证服务运行
ps aux | grep -E "(strategy_manager|api_with_log_streaming)"
```

### SSH 隧道转发（如果无法直接访问）

```bash
# 在本地机器上
ssh -L 5000:localhost:5000 user@remote-server.com

# 然后在 Dashboard 的 .env 中配置
VITE_WORKER_API=http://localhost:5000/api/workers
```

---

## 📞 需要帮助？

运行诊断工具后，截图或复制错误信息，我可以帮你进一步调查。
