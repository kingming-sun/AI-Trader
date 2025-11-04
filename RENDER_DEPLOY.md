# Render 部署指南

## 📋 概述

本指南将帮助你在 Render 平台上使用 Docker 部署 AI-Trader 项目。

## 🚀 快速部署步骤

### 1. 准备代码仓库

确保你的代码已经推送到 GitHub/GitLab/Bitbucket 等 Git 仓库。

### 2. 在 Render 创建新服务

1. 登录 [Render Dashboard](https://dashboard.render.com/)
2. 点击 "New +" → "Web Service"
3. 连接你的 Git 仓库
4. 选择仓库和分支

### 3. 配置服务

**基本设置：**
- **Name**: `ai-trader-platform`
- **Environment**: `Docker`
- **Region**: 选择离你最近的区域
- **Branch**: `main` (或你的主分支)
- **Root Directory**: `/` (项目根目录)
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`

### 4. 环境变量配置

在 Render Dashboard 的 Environment 标签页添加以下环境变量：

#### 必需的环境变量

```bash
# Render 会自动设置 PORT，无需手动配置

# AI 模型配置
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_KEY=your_openai_api_key

# 数据源 API（可选，但推荐）
ALPHAADVANTAGE_API_KEY=your_alpha_vantage_key
JINA_API_KEY=your_jina_api_key

# Moomoo 交易（可选，仅用于实盘/模拟盘）
MOOMOO_HOST=127.0.0.1
MOOMOO_PORT=11111
MOOMOO_TRD_ENV=SIMULATE
MOOMOO_UNLOCK_PWD=your_password
MOOMOO_API_KEY=your_moomoo_key
```

#### 可选的环境变量

```bash
# API 端口（默认值）
MATH_HTTP_PORT=8000
SEARCH_HTTP_PORT=8001
TRADE_HTTP_PORT=8002
GETPRICE_HTTP_PORT=8003
CONFIG_API_PORT=8004
STRATEGY_API_PORT=8005
```

### 5. 部署配置

**Auto-Deploy**: 设置为 `Yes`（每次推送到主分支自动部署）

**Health Check Path**: `/health`

**Build Command**: (留空，使用 Dockerfile)

**Start Command**: `python startup.py`

### 6. 资源限制

**免费计划限制：**
- RAM: 512 MB
- CPU: 0.5 vCPU
- 服务会在 15 分钟无活动后休眠

**付费计划建议：**
- RAM: 1 GB 或更高
- CPU: 1 vCPU 或更高

## 📁 项目结构

```
AI-Trader/
├── Dockerfile              # Docker 构建配置
├── .dockerignore          # Docker 忽略文件
├── startup.py             # 启动脚本（所有服务）
├── render.yaml            # Render 配置文件（可选）
├── requirements.txt       # Python 依赖
├── .env                   # 环境变量（不要提交到 Git）
└── ...                    # 其他项目文件
```

## 🔧 本地测试 Docker

在部署到 Render 之前，可以在本地测试：

```bash
# 构建镜像
docker build -t ai-trader .

# 运行容器
docker run -p 8080:8080 \
  -e OPENAI_API_KEY=your_key \
  -e JINA_API_KEY=your_key \
  ai-trader

# 或使用 docker-compose
docker-compose up
```

## ⚠️ 注意事项

### 1. 数据持久化

Render 的免费计划不提供持久化存储。如果你需要保留数据：
- 使用 Render 的 Disk 插件（付费）
- 或使用外部存储（S3、数据库等）

### 2. 服务休眠

免费计划在 15 分钟无活动后会休眠：
- 首次访问会唤醒服务（可能需要 30-60 秒）
- 考虑使用付费计划或外部监控服务保持活跃

### 3. 端口限制

Render 只暴露一个端口（通过 `PORT` 环境变量）：
- 前端服务使用 `PORT`
- 其他服务（API、MCP）在容器内部运行，通过前端代理访问

### 4. 资源限制

如果服务频繁崩溃：
- 检查日志中的内存/CPU 错误
- 考虑升级到付费计划
- 优化代码减少资源使用

## 🐛 故障排查

### 查看日志

在 Render Dashboard → Logs 标签页查看实时日志。

### 常见问题

1. **服务无法启动**
   - 检查环境变量是否正确设置
   - 查看 Dockerfile 是否正确
   - 检查端口配置

2. **API 调用失败**
   - 确认 API keys 已正确设置
   - 检查网络连接
   - 查看服务日志

3. **前端无法访问后端**
   - 检查 CORS 配置
   - 确认 API 服务已启动
   - 查看浏览器控制台错误

## 📞 获取帮助

- Render 文档: https://render.com/docs
- Render 支持: support@render.com
- 项目 Issues: GitHub Issues

