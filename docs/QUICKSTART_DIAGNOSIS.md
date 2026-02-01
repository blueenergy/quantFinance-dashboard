# WebSocket 连接诊断 - 快速开始

## 🎯 三步快速诊断

### 第 1 步：在远程服务器上运行检查脚本
```bash
# 连接到你的远程服务器
ssh user@192.168.1.100

# 运行快速检查脚本
cd /home/shuyolin/own/quant-strategy-manager
chmod +x examples/quickcheck_websocket.sh
bash examples/quickcheck_websocket.sh 192.168.1.100 3001
```

**这会检查：**
- ✅ 网络连接
- ✅ API 端口（3001 - quantFinance FastAPI 后端）
- ✅ API 响应
- ✅ WebSocket 端口状态
- ✅ 防火墙配置

### 第 2 步：在本地浏览器中打开诊断工具

**选项 A：直接打开本地文件**
```
打开浏览器，输入：
file:///home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html
```

**选项 B：通过 Dashboard 访问（需要 Dashboard 运行）**
```bash
# 在另一个终端启动 Dashboard
cd /home/shuyolin/own/quantFinance-dashboard
npm run dev

# 然后在浏览器中打开
http://localhost:5173/diagnose_integrated.html
```

### 第 3 步：在诊断工具中输入 API 地址

1. 在文本框中输入你的 API 地址：
   ```
   http://192.168.1.100:3001/api/strategy/workers
   ```
   （将 `192.168.1.100` 替换为你的实际服务器 IP）

2. 点击"开始诊断"按钮

3. 等待诊断完成，查看结果

---

## 📊 诊断结果解读

### ✅ 如果所有检查都通过
```
[✓] 网络连接        ✓ 正常
[✓] API 服务        ✓ 正常
[✓] Worker 状态     ✓ 3 个运行中
[✓] WebSocket 连接  ✓ 已测试
```

**下一步：** 检查 Dashboard 的 `.env` 配置：
```bash
# 编辑 .env 文件
cd /home/shuyolin/own/quantFinance-dashboard
nano .env

# 确保 VITE_WORKER_API 指向你的服务器
VITE_WORKER_API=http://192.168.1.100:5000/api/workers
```

然后重新启动 Dashboard：
```bash
npm run dev
```

### ❌ 如果网络连接失败
```
[✗] 网络连接        ✗ 无法连接
```

**原因可能是：**
- IP 地址错误
- 网络不通（不在同一网络或需要 VPN）

**解决方案：**
1. 确认 IP 地址是否正确
2. 尝试 ping 一下：`ping 192.168.1.100`
3. 检查是否需要 VPN
4. 使用 SSH 隧道作为备选方案（见下面的"SSH 隧道"）

### ❌ 如果 API 无法连接
```
[✓] 网络连接        ✓ 正常
[✗] API 服务        ✗ 无法连接（HTTP 错误）
```

**原因可能是：**
- API 服务未启动
- 防火墙阻止了 5000 端口

**解决方案：**

1. **检查 API 是否运行**
   ```bash
   # 在远程服务器上
   ps aux | grep api_with_log_streaming
   ```

2. **如果没有运行，启动 API**
   ```bash
   cd /home/shuyolin/own/quant-strategy-manager
   source .venv/bin/activate
   python examples/api_with_log_streaming.py
   ```

3. **如果仍然超时，打开防火墙**
   ```bash
   sudo firewall-cmd --add-port=5000/tcp --permanent
   sudo firewall-cmd --reload
   ```

### ❌ 如果 API 返回 404 或 500
```
[✓] 网络连接        ✓ 正常
[✗] API 响应        ✗ HTTP 404
```

**解决方案：**
1. 检查 API 代码中是否有 `/api/workers` 路由
2. 查看 API 启动时的错误信息
3. 尝试访问 API 首页：`curl http://192.168.1.100:5000/`

### ❌ 如果没有 Worker 信息
```
[✓] API 响应        ✓ HTTP 200
[✗] Worker 数据     ✗ 没有 Worker
```

**原因可能是：**
- strategy_manager 未启动
- strategy_manager 启动失败

**解决方案：**

1. **启动 strategy_manager**
   ```bash
   cd /home/shuyolin/own/quant-strategy-manager
   source .venv/bin/activate
   python -m strategy_manager.cli start
   ```

2. **等待 Worker 启动**
   第一次启动需要 30-60 秒，耐心等待

3. **检查 Worker 状态**
   ```bash
   python -m strategy_manager.cli status
   ```

4. **查看日志**
   ```bash
   tail -f logs/strategy_manager.log
   ```

### ❌ 如果 WebSocket 连接失败
```
[✓] Worker 发现     ✓ 发现 WebSocket URL
[✗] WebSocket 连接  ✗ 连接失败
```

**原因可能是：**
- WebSocket 端口被防火墙阻止
- WebSocket URL 格式错误（如 `0.0.0.0` 而不是实际 IP）

**解决方案：**

1. **查看 WebSocket URL 格式**
   ```bash
   curl http://192.168.1.100:5000/api/workers | jq '.workers | .[] | .log_stream_url'
   
   # 应该看到：
   # "ws://192.168.1.100:54321"  ✓ 正确
   # 
   # 不应该看到：
   # "ws://0.0.0.0:54321"  ✗ 错误
   ```

2. **如果是 `0.0.0.0`，修复 API 代码**
   - 详见 [TROUBLESHOOT_WEBSOCKET.md](TROUBLESHOOT_WEBSOCKET.md) 中的"高级调试"部分

3. **如果格式正确，打开防火墙**
   ```bash
   # 获取 WebSocket 端口号（例如 54321）
   WSPORT=54321
   
   # 打开防火墙
   sudo firewall-cmd --add-port=$WSPORT/tcp --permanent
   sudo firewall-cmd --reload
   ```

---

## 🔗 其他诊断工具

### 浏览器控制台
```
按 F12 打开开发者工具 → Console 标签
查看所有错误信息
```

### Curl 命令行测试
```bash
# 测试 API 连接
curl -v http://192.168.1.100:5000/api/workers

# 使用 jq 格式化 JSON
curl http://192.168.1.100:5000/api/workers | jq .

# 查看响应头
curl -i http://192.168.1.100:5000/api/workers
```

### Python WebSocket 测试
```python
import asyncio
import websockets

async def test():
    try:
        async with websockets.connect("ws://192.168.1.100:54321") as ws:
            print("✓ 连接成功")
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            print(f"✓ 收到消息: {msg[:100]}")
    except Exception as e:
        print(f"✗ 失败: {e}")

asyncio.run(test())
```

### 完整决策树
如果你不确定问题在哪里，查看：
[DECISION_TREE.md](DECISION_TREE.md)

---

## 🚀 常见情况快速解决方案

### 情况 1：在同一 LAN 网络中，想从另一台机器访问
```bash
# 在远程服务器上找到本机 IP
hostname -I

# 假设是 192.168.1.100，在诊断工具中输入
http://192.168.1.100:5000/api/workers

# 如果连接超时，打开防火墙
sudo firewall-cmd --add-port=5000/tcp --permanent
sudo firewall-cmd --add-port=54320-54330/tcp --permanent  # WebSocket 端口范围
sudo firewall-cmd --reload
```

### 情况 2：在远程开发（VPS）环境中
```bash
# 使用 SSH 隧道转发本地端口
ssh -L 5000:localhost:5000 user@vps.example.com

# 然后在诊断工具中使用
http://localhost:5000/api/workers

# Dashboard .env 中配置
VITE_WORKER_API=http://localhost:5000/api/workers
```

### 情况 3：使用 Nginx 反向代理（生产环境）
```nginx
location /api/workers {
    proxy_pass http://127.0.0.1:5000/api/workers;
    add_header 'Access-Control-Allow-Origin' '*';
}

location /ws/ {
    proxy_pass http://127.0.0.1:54321/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

在诊断工具中：
```
https://your-domain.com/api/workers
```

### 情况 4：检查 CORS 问题
```bash
# 如果浏览器显示 CORS 错误，需要在 API 中启用 CORS
# 编辑 examples/api_with_log_streaming.py，添加：

from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 然后重启 API
```

---

## 📋 检查清单

启动诊断前，确保以下准备完毕：

- [ ] 知道远程服务器的 IP 地址或域名
- [ ] 能够 SSH 连接到远程服务器
- [ ] 远程服务器上已安装 Python 和依赖
- [ ] 已经在远程服务器上运行过初始设置（`pip install -r requirements.txt`）

---

## 💬 需要帮助？

1. **收集诊断信息**
   - 运行诊断脚本的输出
   - 浏览器控制台中的错误信息（F12）
   - API 返回的 JSON 数据
   - 进程状态（`ps aux | grep ...`）

2. **查看详细文档**
   - [TROUBLESHOOT_WEBSOCKET.md](TROUBLESHOOT_WEBSOCKET.md) - 详细故障排查
   - [DECISION_TREE.md](DECISION_TREE.md) - 完整决策树
   - [ENV_CONFIGURATION.md](ENV_CONFIGURATION.md) - 环境配置说明

3. **手动调试命令**
   ```bash
   # 查看 API 日志
   tail -f /home/shuyolin/own/quant-strategy-manager/logs/api.log
   
   # 查看 Strategy Manager 日志
   tail -f /home/shuyolin/own/quant-strategy-manager/logs/strategy_manager.log
   
   # 查看 Worker 日志
   ls -la /home/shuyolin/own/quant-strategy-manager/logs/worker_*.log
   ```

---

## 📞 常见问题

**Q: 诊断工具在哪里？**
A: 有两个版本：
- 集成版：`file:///home/shuyolin/own/quantFinance-dashboard/diagnose_integrated.html`
- 脚本版：`bash /home/shuyolin/own/quant-strategy-manager/examples/quickcheck_websocket.sh`

**Q: 我能在 Windows 上运行检查脚本吗？**
A: Shell 脚本需要 Linux/Mac 或 Git Bash。在 Windows 上使用浏览器诊断工具代替。

**Q: 如何测试 WebSocket 连接？**
A: 
- 在浏览器中：使用诊断工具的 WebSocket 测试功能
- 在命令行中：使用 `websocat` 或 Python 脚本（见上面的代码示例）

**Q: 防火墙规则只能打开特定端口吗？**
A: 是的，建议只打开必要的端口（5000 API + 动态 WebSocket 端口范围），而不是所有端口。

**Q: 我可以在生产环境中使用这些诊断工具吗？**
A: 可以，但诊断工具只用于故障排查，不应该暴露给外网。在生产环境中建议使用 Nginx 或 API 网关代替。

---

*最后更新：2024年*
