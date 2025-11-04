# 快速启动指南

## 🚀 一键启动所有服务

### 方法 1：使用启动脚本（推荐）

```bash
./start.sh
```

这个脚本会自动启动：
1. ✅ MCP Services（Math, Search, Trade, Price）
2. ✅ Config API（端口 8004）
3. ✅ Strategy API（端口 8005）
4. ✅ Frontend Server（端口 8000）

### 停止所有服务

```bash
./stop.sh
```

## 📋 手动启动（如果需要）

### 终端 1：启动 MCP 服务
```bash
cd agent_tools
python start_mcp_services.py
```

### 终端 2：启动配置 API
```bash
python config_api.py
```

### 终端 3：启动策略 API
```bash
python platform/strategy_api.py
```

### 终端 4：启动前端
```bash
cd docs
python3 -m http.server 8000
```

## 🌐 访问地址

- **前端界面**: http://localhost:8000
- **策略管理**: http://localhost:8000/strategies.html
- **配置管理**: http://localhost:8000/config.html
- **结果分析**: http://localhost:8000/index.html

## ⚠️ 注意事项

1. **MCP 服务必须运行**：运行策略前必须先启动 MCP 服务
2. **端口占用**：确保端口 8000-8005 未被占用
3. **虚拟环境**：脚本会自动激活 `venv`（如果存在）

## 🔍 检查服务状态

访问策略管理页面（http://localhost:8000/strategies.html），可以看到所有服务的运行状态。

## 📝 日志文件

所有服务的日志保存在 `logs/` 目录：
- `logs/mcp_services.log` - MCP 服务日志
- `logs/config_api.log` - 配置 API 日志
- `logs/strategy_api.log` - 策略 API 日志
- `logs/frontend.log` - 前端服务器日志

