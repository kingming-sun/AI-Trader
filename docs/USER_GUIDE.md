# AI-Trader 用户指南

## 📋 目录

1. [快速开始](#快速开始)
2. [系统架构](#系统架构)
3. [配置管理](#配置管理)
4. [策略管理](#策略管理)
5. [运行模式](#运行模式)
6. [Moomoo 真实交易](#moomoo-真实交易)
7. [前端界面](#前端界面)
8. [API 服务](#api-服务)
9. [常见问题](#常见问题)

---

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/HKUDS/AI-Trader.git
cd AI-Trader

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# AI 模型 API 配置
OPENAI_API_BASE=https://your-openai-proxy.com/v1
OPENAI_API_KEY=your_openai_key

# 数据源配置
ALPHAADVANTAGE_API_KEY=your_alpha_vantage_key
JINA_API_KEY=your_jina_api_key

# Moomoo 真实交易（可选）
MOOMOO_HOST=127.0.0.1
MOOMOO_PORT=11111
MOOMOO_TRD_ENV=SIMULATE  # SIMULATE 或 REAL
MOOMOO_UNLOCK_PWD=your_password
MOOMOO_API_KEY=your_moomoo_api_key

# 系统配置
RUNTIME_ENV_PATH=./runtime_env.json
```

### 3. 启动服务

#### 方式一：一键启动（推荐）

```bash
./start.sh
```

这会启动：
- MCP 服务（Math, Search, Trade, Price）
- 配置 API (端口 8004)
- 策略 API (端口 8005)
- 前端服务器 (端口 8000)

#### 方式二：手动启动

```bash
# 1. 启动 MCP 服务
cd agent_tools
python start_mcp_services.py

# 2. 启动配置 API
python config_api.py

# 3. 启动策略 API
python platform/strategy_api.py

# 4. 启动前端
cd docs
python3 -m http.server 8000
```

### 4. 运行回测

```bash
python main.py
```

---

## 🏗️ 系统架构

### 核心组件

```
AI-Trader/
├── main.py                    # 主程序入口
├── agent/                     # AI 代理核心
│   └── base_agent/
├── agent_tools/               # MCP 工具链
│   ├── tool_trade.py          # 交易工具
│   ├── tool_get_price_local.py # 价格查询
│   ├── tool_jina_search.py    # 信息搜索
│   └── tool_math.py           # 数学计算
├── platform/                  # 平台管理模块
│   ├── strategy_manager.py     # 策略管理
│   ├── run_manager.py         # 运行管理
│   ├── service_manager.py     # 服务管理
│   └── strategy_api.py         # 策略 API
├── configs/                    # 配置文件
│   └── default_config.json    # 默认配置
├── prompts/                   # Prompt 模板
│   └── agent_prompt.py        # 系统提示词
└── docs/                      # 前端界面
    ├── index.html             # 资产演化图表
    ├── portfolio.html         # 组合分析
    ├── config.html            # 配置管理
    └── strategies.html        # 策略管理
```

### 工作流程

```
策略设计 → 回测验证 → 模拟盘测试 → 实盘交易
```

---

## ⚙️ 配置管理

### 配置文件结构

`configs/default_config.json` 包含：

```json
{
  "date_range": {
    "init_date": "2025-10-28",
    "end_date": "2025-10-31"
  },
  "models": [
    {
      "name": "deepseek-chat-v3.1",
      "basemodel": "deepseek/deepseek-chat-v3.1",
      "signature": "deepseek-chat-v3.1",
      "enabled": true,
      "openai_base_url": "https://api.deepseek.com/v1",
      "openai_api_key": "your_key"
    }
  ],
  "agent_config": {
    "max_steps": 30,
    "max_retries": 3,
    "base_delay": 1.0,
    "initial_cash": 10000.0
  }
}
```

### 通过前端修改配置

1. 访问 `http://localhost:8000/config.html`
2. 点击 "Load Current Config" 加载当前配置
3. 修改参数后点击 "Save Configuration"
4. **重要**：修改后需要重启 `main.py` 才能生效

### 配置参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `max_steps` | AI 最大推理步数 | 30 |
| `max_retries` | 失败重试次数 | 3 |
| `base_delay` | 重试延迟（秒） | 1.0 |
| `initial_cash` | 初始资金（美元） | 10000.0 |

---

## 📊 策略管理

### 什么是策略？

**策略 = Prompt + 参数配置 + 模式配置**

策略包含：
1. **Prompt（提示词）** - 定义 AI 的交易逻辑和决策风格
2. **参数配置** - Agent 参数、模型选择、日期范围
3. **模式配置** - 回测/模拟/实盘的特定设置

### 策略生命周期

```
创建策略 → 配置参数 → 回测验证 → 模拟盘测试 → 实盘交易
```

### 通过前端管理策略

1. 访问 `http://localhost:8000/strategies.html`
2. 创建新策略
3. 配置不同模式的参数和 Prompt
4. 运行策略（回测/模拟/实盘）

### 策略目录结构

```
configs/strategies/
└── strategy_20251104_120000/
    ├── base_config.json          # 基础配置
    ├── backtest_config.json      # 回测配置
    ├── simulate_config.json      # 模拟盘配置
    ├── real_config.json          # 实盘配置
    └── prompts/
        ├── base_prompt.py        # 基础 Prompt
        ├── backtest_prompt.py    # 回测 Prompt（可选）
        ├── simulate_prompt.py    # 模拟盘 Prompt（可选）
        └── real_prompt.py         # 实盘 Prompt（可选）
```

---

## 🎮 运行模式

### 1. 回测模式（Backtest）

使用历史数据测试策略：

```json
{
  "date_range": {
    "init_date": "2025-01-01",
    "end_date": "2025-10-31"
  },
  "use_realtime_data": false
}
```

**特点：**
- ✅ 使用历史价格数据
- ✅ 快速验证策略
- ✅ 无资金风险
- ❌ 无法测试实时市场反应

### 2. 模拟盘模式（Simulate）

使用实时数据但模拟交易：

```json
{
  "date_range": {
    "init_date": "2025-11-04",
    "end_date": "2025-11-04"
  },
  "use_realtime_data": true,
  "moomoo_env": "SIMULATE"
}
```

**特点：**
- ✅ 使用实时市场数据
- ✅ 模拟真实交易执行
- ✅ 无资金风险
- ✅ 验证策略在真实市场中的表现

### 3. 实盘模式（Real）

使用真实资金进行交易：

```json
{
  "date_range": {
    "init_date": "2025-11-04",
    "end_date": null  // 持续运行
  },
  "use_realtime_data": true,
  "moomoo_env": "REAL",
  "risk_control": {
    "max_daily_loss": 0.05,      // 最大单日亏损 5%
    "max_position_size": 0.2,     // 单只股票最大仓位 20%
    "stop_loss": 0.1              // 止损比例 10%
  }
}
```

**特点：**
- ✅ 真实资金交易
- ⚠️ 有资金风险
- ⚠️ 需要谨慎配置风险控制

---

## 🔌 Moomoo 真实交易

### 准备工作

1. **Moomoo 账户** - 需要开户并激活交易权限
2. **API 密钥** - 在 moomoo 官网申请
3. **OpenD 网关** - 下载并启动 OpenD 程序

### 安装 OpenD

1. 访问 https://openapi.moomoo.com/
2. 下载对应操作系统的 OpenD 程序
3. 启动 OpenD（默认端口 11111）

### 配置环境变量

```bash
MOOMOO_HOST=127.0.0.1
MOOMOO_PORT=11111
MOOMOO_TRD_ENV=SIMULATE  # 或 REAL
MOOMOO_UNLOCK_PWD=your_password
MOOMOO_API_KEY=your_api_key
```

### 运行模式

#### 模拟盘（推荐先测试）

```bash
export MOOMOO_TRD_ENV=SIMULATE
python main.py
```

#### 实盘（需谨慎）

```bash
export MOOMOO_TRD_ENV=REAL
python main.py
```

### 风险控制

实盘模式下，系统会自动应用风险控制：
- 最大单日亏损：5%
- 单只股票最大仓位：20%
- 止损比例：10%

---

## 🎨 前端界面

### 主要页面

1. **Asset Evolution** (`index.html`)
   - 显示所有 AI 模型的资产演化曲线
   - 对比不同模型的收益表现
   - 显示交易模式（回测/模拟/实盘）

2. **Portfolio Analysis** (`portfolio.html`)
   - 查看单个模型的详细持仓
   - 分析交易历史
   - 查看收益统计

3. **Configuration** (`config.html`)
   - 修改交易日期范围
   - 调整 Agent 配置参数
   - 启用/禁用模型
   - 编辑 Prompt

4. **Strategy Management** (`strategies.html`)
   - 创建和管理策略
   - 配置不同模式的参数
   - 运行策略（回测/模拟/实盘）
   - 管理平台服务

### 访问方式

```bash
# 启动前端服务器
cd docs
python3 -m http.server 8000

# 访问页面
http://localhost:8000/index.html
http://localhost:8000/portfolio.html
http://localhost:8000/config.html
http://localhost:8000/strategies.html
```

---

## 🔧 API 服务

### 配置 API (端口 8004)

提供配置管理接口：

```bash
# 获取配置
GET http://localhost:8004/api/config

# 保存配置
POST http://localhost:8004/api/config
Body: { "config": {...} }

# 获取 Prompt
GET http://localhost:8004/api/prompt

# 保存 Prompt
POST http://localhost:8004/api/prompt
Body: { "prompt": "..." }

# 重启 main.py
POST http://localhost:8004/api/restart-main

# 检查 main.py 状态
GET http://localhost:8004/api/main-status
```

### 策略 API (端口 8005)

提供策略管理接口：

```bash
# 列出所有策略
GET http://localhost:8005/api/strategies

# 创建策略
POST http://localhost:8005/api/strategies
Body: {
  "strategy_name": "保守型策略",
  "description": "低风险策略"
}

# 获取策略配置
GET http://localhost:8005/api/strategies/{id}/config/{mode}

# 保存策略配置
POST http://localhost:8005/api/strategies/{id}/config/{mode}
Body: { "config": {...} }

# 运行策略
POST http://localhost:8005/api/strategies/{id}/run/{mode}

# 获取服务状态
GET http://localhost:8005/api/services/status

# 启动/停止 MCP 服务
POST http://localhost:8005/api/services/mcp/start
POST http://localhost:8005/api/services/mcp/stop
```

---

## ❓ 常见问题

### Q1: 前端显示"Loading trading data..."一直卡住？

**A:** 可能原因：
1. 数据文件路径不正确
2. 价格数据文件缺失或格式错误
3. 浏览器控制台有错误

**解决方法：**
- 检查浏览器控制台的错误信息
- 确认 `docs/data/agent_data/` 目录下有数据文件
- 刷新页面重试

### Q2: 修改配置后不生效？

**A:** 修改配置后需要重启 `main.py`：
1. 通过配置页面点击 "Restart main.py" 按钮
2. 或手动停止并重新运行 `python main.py`

### Q3: 前端显示的"Trading Period"不更新？

**A:** 前端显示的"Trading Period"是从实际交易数据中提取的，不是从配置文件读取的。如果需要更新，需要：
1. 修改配置中的日期范围
2. 重启 `main.py` 运行新的交易
3. 前端会自动显示新的交易日期范围

### Q4: 如何区分回测、模拟盘、实盘的结果？

**A:** 前端界面会自动识别并显示：
- **回测**：蓝色标签 "回测"
- **模拟盘**：黄色标签 "模拟盘"
- **实盘**：红色标签 "实盘"

### Q5: MCP 服务启动失败？

**A:** 检查：
1. 端口是否被占用（8000-8003）
2. 依赖是否安装完整
3. 查看服务日志

**解决方法：**
```bash
# 检查端口占用
lsof -i :8000

# 手动启动 MCP 服务
cd agent_tools
python start_mcp_services.py
```

### Q6: 策略 API 无法访问？

**A:** 确认：
1. 策略 API 是否已启动（端口 8005）
2. 防火墙是否阻止访问
3. 查看 API 日志

**解决方法：**
```bash
# 手动启动策略 API
python platform/strategy_api.py

# 测试 API
curl http://localhost:8005/api/strategies
```

---

## 📚 更多资源

- **项目仓库**: https://github.com/HKUDS/AI-Trader
- **Moomoo OpenAPI 文档**: https://openapi.moomoo.com/
- **问题反馈**: 通过 GitHub Issues

---

## ⚠️ 免责声明

本系统仅供研究和学习使用。使用真实交易功能时，请：
- 充分了解风险
- 谨慎配置风险控制参数
- 使用模拟盘充分测试后再考虑实盘
- 承担所有交易风险和责任

---

**最后更新**: 2025-11-04

