# Render 快速部署指南

## ✅ 是的，Render 给的地址就是前端！

部署成功后，Render 会给你一个类似 `https://your-app.onrender.com` 的地址，**直接访问这个地址就会打开前端界面**。

## 📋 部署步骤

### 1. 准备文件（已完成）
以下文件已创建：
- ✅ `Dockerfile` - Docker 构建配置
- ✅ `.dockerignore` - Docker 忽略文件
- ✅ `startup.py` - 启动脚本（启动所有服务）
- ✅ `render.yaml` - Render 配置文件（可选）
- ✅ `docker-compose.yml` - 本地测试用（可选）

### 2. 在 Render 创建服务

1. 登录 [Render Dashboard](https://dashboard.render.com/)
2. 点击 **"New +"** → **"Web Service"**
3. 连接你的 Git 仓库
4. 配置服务：
   - **Name**: `ai-trader-platform`
   - **Environment**: `Docker`
   - **Region**: 选择离你最近的
   - **Branch**: `main`
   - **Root Directory**: `/` (留空或填 `/`)
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.` (留空或填 `.`)

### 3. 设置环境变量

在 Render Dashboard → Environment 标签页添加：

```bash
# 必需
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_KEY=your_key

# 可选（但推荐）
ALPHAADVANTAGE_API_KEY=your_key
JINA_API_KEY=your_key
```

### 4. 部署

- **Auto-Deploy**: `Yes` (自动部署)
- **Health Check Path**: `/health`
- **Build Command**: (留空，使用 Dockerfile)
- **Start Command**: `python startup.py`

### 5. 访问

部署成功后，Render 会给你一个地址，例如：
```
https://ai-trader-platform.onrender.com
```

**直接访问这个地址就会打开前端界面！**

## 🌐 访问路径

部署后，你可以访问：

- **首页**: `https://your-app.onrender.com/index.html` 或 `/`
- **策略管理**: `https://your-app.onrender.com/strategies.html`
- **配置管理**: `https://your-app.onrender.com/config.html`
- **服务状态**: `https://your-app.onrender.com/services.html`
- **策略详情**: `https://your-app.onrender.com/strategy-detail.html?id=xxx`

## 🔧 工作原理

```
用户访问 Render 地址
  ↓
Render 路由到容器（PORT 环境变量）
  ↓
startup.py 启动所有服务：
  ├─ MCP 服务（8000-8003，内部）
  ├─ Config API（8004，内部）
  ├─ Strategy API（8005，内部）
  └─ 前端服务器（PORT，对外）
  ↓
前端页面自动检测环境
  ↓
使用 /api-proxy/ 代理访问后端 API
  ↓
所有功能正常工作！
```

## ⚠️ 注意事项

1. **首次访问可能较慢**：免费计划在 15 分钟无活动后会休眠，首次访问需要 30-60 秒唤醒
2. **数据持久化**：免费计划不提供持久化存储，数据会在重启后丢失
3. **资源限制**：免费计划有 CPU 和内存限制，可能影响性能

## 🐛 故障排查

如果遇到问题：

1. **查看日志**：Render Dashboard → Logs
2. **检查环境变量**：确保所有必需的 API keys 已设置
3. **测试健康检查**：访问 `https://your-app.onrender.com/health` 应该返回 `{"status":"ok"}`

## 📝 本地测试

部署前可以本地测试 Docker：

```bash
# 构建
docker build -t ai-trader .

# 运行
docker run -p 8080:8080 \
  -e OPENAI_API_KEY=test \
  -e JINA_API_KEY=test \
  ai-trader

# 访问
# http://localhost:8080
```

