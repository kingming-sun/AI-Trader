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

### 架构概览

AI-Trader 采用分层架构设计，包含前端界面、后端 API、策略管理、MCP 工具服务和数据存储等核心模块。

```
┌─────────────────────────────────────────────────────────┐
│                      用户界面层                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  首页    │  │ 策略管理  │  │ 服务状态  │            │
│  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────┘
                         ↕ HTTP API
┌─────────────────────────────────────────────────────────┐
│                     API 服务层                          │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 策略 API     │  │ 配置 API      │                    │
│  │ (端口 8005)  │  │ (端口 8004)  │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   业务逻辑层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 策略管理器   │  │ 运行管理器   │  │ 服务管理器   │ │
│  │StrategyMgr  │  │ RunManager   │  │ServiceMgr   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                  MCP 工具服务层                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │ 交易工具 │  │ 价格工具 │  │ 搜索工具 │  │ 数学工具││
│  │Trade    │  │ Price    │  │ Search   │  │ Math    ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   核心执行层                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  main.py - AI Agent 执行引擎                      │  │
│  │  BaseAgent - AI 代理核心                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                    数据存储层                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 配置文件      │  │ 交易数据      │  │ 日志文件      │ │
│  │configs/      │  │data/         │  │logs/         │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 核心组件详解

#### 1. 前端界面层

**位置**: `docs/`

**主要页面**:
- `home.html` - 平台首页，提供策略管理和服务状态入口
- `strategies.html` - 策略管理页面，显示策略列表和创建新策略
- `strategy-detail.html` - 策略详情页面，包含配置管理、资产演变、投资组合分析
- `services.html` - 平台服务状态页面，监控 MCP 和 API 服务

**技术栈**:
- 纯 HTML/CSS/JavaScript
- Chart.js 用于数据可视化
- 通过 HTTP API 与后端通信

#### 2. API 服务层

**策略 API** (`platform/strategy_api.py`, 端口 8005):
- 策略管理：创建、删除、列表、配置保存/加载
- 策略运行：启动回测/模拟盘/实盘
- **运行状态监控**：实时检查策略运行状态（运行中/已完成/失败）
- **进程管理**：跟踪策略执行进程，提供进程ID和启动时间
- 结果查询：获取资产演变、投资组合、日志数据
- **AI思考日志**：按日期查询AI决策过程的详细日志
- 服务管理：MCP 服务启动/停止、状态查询

**配置 API** (`config_api.py`, 端口 8004):
- 配置管理：读取/保存默认配置
- Prompt 管理：读取/保存系统提示词
- 进程管理：重启 main.py、检查运行状态

#### 3. 业务逻辑层

**策略管理器** (`platform/strategy_manager.py`):
- 策略创建和管理
- 配置文件的读写（JSON 格式）
- Prompt 文件的管理（Python 格式）
- 策略数据路径管理

**运行管理器** (`platform/run_manager.py`):
- 策略执行流程管理
- 运行模式切换（回测/模拟盘/实盘）
- 环境变量和配置文件的准备
- 与 main.py 的集成
- **运行状态检查**：使用 `psutil` 检查进程是否运行
- **进程信息管理**：保存进程ID、启动时间到 `logs/{strategy_id}_{mode}_process.json`
- **实时日志获取**：从日志文件读取最新AI思考日志并返回给前端
- **结果数据加载**：从策略数据目录加载资产演变、投资组合、交易数据

**服务管理器** (`platform/service_manager.py`):
- MCP 服务进程管理
- 服务状态监控
- 服务启动/停止控制

#### 4. MCP 工具服务层

**MCP (Model Context Protocol) 服务** (`agent_tools/`):

| 服务 | 文件 | 端口 | 功能 |
|------|------|------|------|
| 交易工具 | `tool_trade.py` | 8002 | 买入/卖出股票、持仓管理 |
| 价格工具 | `tool_get_price_local.py` | 8003 | 历史价格查询、实时价格获取 |
| 搜索工具 | `tool_jina_search.py` | 8001 | 市场信息搜索、新闻查询 |
| 数学工具 | `tool_math.py` | 8000 | 金融计算、数据分析 |

**启动方式**: `agent_tools/start_mcp_services.py` 统一管理所有 MCP 服务

#### 5. 核心执行层

**主程序** (`main.py`):
- AI Agent 的启动和调度
- 交易日历管理
- 多模型并发执行
- 交易记录和日志生成

**AI 代理** (`agent/base_agent/base_agent.py`):
- 基于 LangChain 的 AI Agent 实现
- MCP 工具集成
- 自主决策和交易执行
- 思考过程记录

#### 6. 数据存储层

**配置文件** (`configs/`):
```
configs/
├── default_config.json          # 默认配置
├── strategies/                   # 策略配置目录
│   └── {strategy_id}/
│       ├── base_config.json     # 基础配置
│       ├── backtest_config.json # 回测配置
│       ├── simulate_config.json # 模拟盘配置
│       ├── real_config.json     # 实盘配置
│       └── prompts/             # Prompt 文件
│           ├── base_prompt.py
│           ├── backtest_prompt.py
│           ├── simulate_prompt.py
│           └── real_prompt.py
```

**交易数据** (`data/`):
```
data/
├── merged.jsonl                 # 统一价格数据
├── strategies/                  # 策略数据目录
│   └── {strategy_id}/
│       ├── backtest/            # 回测数据
│       │   └── agent_data/
│       │       ├── position/    # 持仓记录
│       │       └── log/         # AI 思考日志
│       ├── simulate/            # 模拟盘数据
│       └── real/                # 实盘数据
└── agent_data/                  # 旧格式数据（兼容）
```

**日志文件** (`logs/`):
- `mcp_services.log` - MCP 服务日志
- `strategy_api.log` - 策略 API 日志
- `config_api.log` - 配置 API 日志
- `frontend.log` - 前端服务器日志
- `{strategy_id}_{mode}_process.json` - 策略运行进程信息（进程ID、启动时间、状态）

### 运行模式

系统支持三种运行模式：

#### 回测模式 (Backtest)
- **数据来源**: 历史价格数据 (`merged.jsonl`)
- **执行方式**: 使用历史数据模拟交易
- **配置**: 需要设置日期范围
- **用途**: 策略验证和优化

#### 模拟盘模式 (Simulate)
- **数据来源**: Moomoo 实时市场数据
- **执行方式**: 使用实时数据模拟交易（无真实资金）
- **配置**: 无需设置日期范围
- **用途**: 真实市场环境测试

#### 实盘模式 (Real)
- **数据来源**: Moomoo 实时市场数据
- **执行方式**: 使用真实资金执行交易
- **配置**: 无需设置日期范围，需要风险确认
- **用途**: 真实交易执行

### 数据流

#### 策略执行数据流
```
用户操作 (前端)
    ↓
HTTP API 请求 (POST /api/strategies/{id}/run/{mode})
    ↓
API 服务层 (strategy_api.py)
    ↓
运行管理器 (run_manager.py)
    ├─ 检查MCP服务状态
    ├─ 准备配置文件和环境变量
    ├─ 启动 main.py 子进程
    └─ 保存进程信息到 logs/
    ↓
核心执行层 (main.py + BaseAgent)
    ├─ 执行交易逻辑
    ├─ 写入交易数据到 data/strategies/{id}/{mode}/
    └─ 写入AI思考日志到 data/strategies/{id}/{mode}/agent_data/log/
    ↓
数据存储层 (文件系统)
    ↓
结果返回 (JSON)
    ↓
前端展示
```

#### 运行状态监控数据流
```
前端状态轮询 (每2秒)
    ↓
HTTP API 请求 (GET /api/strategies/{id}/status/{mode})
    ↓
API 服务层 (strategy_api.py)
    ↓
运行管理器 (run_manager.py)
    ├─ 读取进程信息文件 logs/{id}_{mode}_process.json
    ├─ 使用 psutil 检查进程是否运行
    ├─ 读取最新日志文件获取最新日志内容
    └─ 检查结果数据文件是否存在
    ↓
返回状态信息 (JSON)
    ├─ is_running: 是否正在运行
    ├─ status: 状态 (running/completed/failed)
    ├─ latest_log: 最新日志内容
    └─ message: 状态消息
    ↓
前端更新显示
    ├─ 更新进度条
    ├─ 显示实时日志
    └─ 更新状态图标和文本
```

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
│   ├── tool_math.py           # 数学计算
│   ├── moomoo_client.py       # Moomoo 客户端
│   └── start_mcp_services.py  # MCP 服务启动器
├── platform/                  # 平台管理模块
│   ├── strategy_manager.py     # 策略管理
│   ├── run_manager.py         # 运行管理
│   ├── service_manager.py     # 服务管理
│   └── strategy_api.py         # 策略 API
├── tools/                      # 工具函数
│   ├── general_tools.py       # 通用工具
│   ├── price_tools.py         # 价格工具
│   └── result_tools.py        # 结果分析工具
├── configs/                    # 配置文件
│   ├── default_config.json    # 默认配置
│   └── strategies/             # 策略配置目录
├── prompts/                   # Prompt 模板
│   └── agent_prompt.py        # 系统提示词
├── data/                      # 数据目录
│   ├── merged.jsonl           # 统一价格数据
│   └── strategies/           # 策略数据
├── logs/                      # 日志目录
└── docs/                      # 前端界面
    ├── home.html              # 首页
    ├── strategies.html        # 策略管理
    ├── strategy-detail.html   # 策略详情
    ├── services.html          # 服务状态
    ├── index.html             # 资产演化图表
    ├── portfolio.html         # 组合分析
    └── assets/                # 前端资源
        ├── css/               # 样式文件
        └── js/                # JavaScript 文件
```

### 服务端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端服务器 | 8000 | HTTP 静态文件服务 |
| MCP 数学工具 | 8000 | 数学计算服务 |
| MCP 搜索工具 | 8001 | 信息搜索服务 |
| MCP 交易工具 | 8002 | 交易执行服务 |
| MCP 价格工具 | 8003 | 价格查询服务 |
| 配置 API | 8004 | 配置管理 API |
| 策略 API | 8005 | 策略管理 API |

**注意**: MCP 数学工具和前端服务器都使用端口 8000，但它们是不同的服务，不会同时运行。

### 工作流程

```
策略设计 → 配置参数 → 回测验证 → 模拟盘测试 → 实盘交易
    ↓         ↓          ↓           ↓           ↓
  创建策略   保存配置   历史数据    实时模拟    真实交易
```

### 架构设计原则

1. **分层解耦**: 各层之间通过清晰的接口通信，降低耦合度
2. **模块化**: 每个功能模块独立，便于维护和扩展
3. **策略隔离**: 不同策略的配置和数据完全隔离
4. **模式区分**: 明确区分回测、模拟盘、实盘三种运行模式
5. **工具驱动**: 基于 MCP 协议，AI 通过工具调用完成所有操作
6. **数据持久化**: 所有配置和交易数据都保存到文件系统
7. **实时监控**: 前端通过轮询机制实时监控策略运行状态
8. **日志追踪**: 完整的AI思考过程记录，便于调试和分析

### 新增功能详解

#### 1. 运行状态监控系统

**功能概述**: 实时监控策略运行状态，提供进度显示和日志输出

**后端实现**:
- **进程跟踪**: 使用 `psutil` 库检查进程是否运行
- **状态文件**: 在 `logs/{strategy_id}_{mode}_process.json` 保存进程信息
- **日志读取**: 从 `data/strategies/{id}/{mode}/agent_data/log/{date}/log.jsonl` 读取最新日志
- **状态判断**: 根据进程状态和结果文件判断策略运行状态

**前端实现**:
- **状态容器**: 显示运行状态、进度条、实时日志
- **轮询机制**: 每2秒调用状态API检查运行状态
- **进度显示**: 运行中显示60%进度条（带动画），完成显示100%
- **日志显示**: 实时显示最新日志内容，自动滚动到底部
- **状态图标**: 运行中⏳、已完成✅、失败❌、未启动⏸️

**状态流转**:
```
未启动 → 运行中 → 已完成/失败
  ↓         ↓           ↓
 隐藏    显示进度    显示结果
        显示日志    自动刷新数据
```

#### 2. AI思考日志系统

**功能概述**: 记录和展示AI决策过程的详细日志

**日志存储结构**:
```
data/strategies/{strategy_id}/{mode}/agent_data/log/
└── {date}/                    # 按日期分类
    └── log.jsonl             # JSON Lines 格式日志
        ├── timestamp         # 时间戳
        ├── signature         # 模型签名
        └── new_messages      # AI消息内容
```

**日志内容**:
- AI的思考过程
- 工具调用记录
- 市场分析结果
- 交易决策理由

**API端点**:
- `GET /api/strategies/{id}/logs/dates/{mode}` - 获取可用日志日期列表
- `GET /api/strategies/{id}/logs/{mode}/{date}` - 获取指定日期的完整日志

**前端展示**:
- 日期选择器：选择要查看的日志日期
- 日志内容区：格式化显示AI思考过程
- 自动滚动：新日志自动滚动到可见区域

#### 3. 策略运行按钮管理

**功能位置**: 策略详情页 → 资产演变标签 → 模式选择器下方

**显示逻辑**:
- 回测模式：显示"🚀 开启回测"按钮
- 模拟盘模式：显示"🎯 开启模拟"按钮
- 实盘模式：显示"⚡ 开始实盘"按钮
- 其他模式：隐藏对应按钮

**按钮行为**:
1. 点击按钮 → 确认对话框
2. 确认后 → 调用运行API
3. 启动成功 → 显示状态容器
4. 开始状态监控 → 自动刷新数据

#### 4. 进程管理机制

**进程信息保存**:
```json
{
  "strategy_id": "strategy_20251104_120000",
  "mode": "backtest",
  "process_id": 12345,
  "config_file": "configs/runtime_strategy_20251104_120000_backtest.json",
  "start_time": 1699123456.789,
  "status": "running"
}
```

**进程检查流程**:
1. 读取进程信息文件
2. 使用 `psutil.Process(pid)` 检查进程
3. 验证进程命令行包含 `main.py`
4. 检查进程是否真正运行
5. 返回状态信息

**状态判断**:
- `is_running = true`: 进程存在且运行中
- `status = "completed"`: 进程结束且有结果文件
- `status = "failed"`: 进程结束但无结果文件
- `status = "not_started"`: 无进程信息文件

#### 5. 前端实时更新机制

**轮询策略**:
- **频率**: 每2秒检查一次状态
- **触发时机**: 
  - 策略启动后立即开始
  - 页面加载时检查是否有正在运行的策略
- **停止条件**: 
  - 策略运行完成
  - 策略运行失败
  - 用户离开页面

**更新内容**:
- 运行状态图标和文本
- 进度条进度（30% → 60% → 100%）
- 最新日志内容
- 状态消息

**性能优化**:
- 日志去重：避免重复显示相同日志
- 条件更新：仅在有新日志时更新显示
- 自动清理：完成3秒后自动隐藏状态容器

#### 6. 错误处理和容错机制

**后端错误处理**:
- 进程不存在：返回 `status: "failed"`
- 日志文件不存在：返回 `latest_log: null`
- 权限错误：捕获异常并返回错误信息
- 文件读取错误：返回空状态信息

**前端错误处理**:
- API请求失败：在控制台记录错误，不影响其他功能
- 状态检查失败：显示"检查状态时出错"消息
- 日志加载失败：显示"加载失败"提示
- 数据为空：显示"暂无数据"提示

#### 7. 数据持久化机制

**进程信息持久化**:
- 文件位置：`logs/{strategy_id}_{mode}_process.json`
- 保存时机：策略启动时立即保存
- 更新时机：状态检查时更新状态字段
- 清理时机：策略完成后保留（用于历史记录）

**日志持久化**:
- 格式：JSON Lines (`.jsonl`)
- 位置：`data/strategies/{id}/{mode}/agent_data/log/{date}/log.jsonl`
- 追加模式：每次AI交互追加新日志
- 按日期分类：每天一个日志文件

**结果数据持久化**:
- 资产演变：`data/strategies/{id}/{mode}/agent_data/asset_evolution.json`
- 投资组合：`data/strategies/{id}/{mode}/agent_data/portfolio.json`
- 交易记录：`data/strategies/{id}/{mode}/agent_data/trades.json`

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

# 删除策略
DELETE http://localhost:8005/api/strategies/{id}

# 获取日志日期列表
GET http://localhost:8005/api/strategies/{id}/logs/dates/{mode}

# 获取指定日期的日志内容
GET http://localhost:8005/api/strategies/{id}/logs/{mode}/{date}

# 获取策略运行状态（新增）
GET http://localhost:8005/api/strategies/{id}/status/{mode}
Response: {
  "success": true,
  "status": {
    "is_running": true,
    "status": "running",
    "process_id": 12345,
    "start_time": 1699123456.789,
    "latest_log": "AI正在分析市场趋势...",
    "message": "策略正在运行中..."
  }
}

# 重启服务
POST http://localhost:8005/api/restart-service
Body: { "strategy_id": "..." }

# 获取服务状态
GET http://localhost:8005/api/services/status

# 启动/停止 MCP 服务
POST http://localhost:8005/api/services/mcp/start
POST http://localhost:8005/api/services/mcp/stop
```

---

## 🎯 核心功能详解

### 1. 策略管理

#### 创建策略
1. 进入"策略管理"页面
2. 点击"创建新策略"按钮
3. 输入策略名称和描述
4. 系统自动创建策略配置目录

#### 删除策略
1. 在策略列表中找到要删除的策略
2. 点击"删除"按钮（红色，位于策略卡片右下角）
3. 确认删除操作
4. ⚠️ **注意**：运行中的策略无法删除，需要先停止运行

#### 策略配置
- **配置管理模式**：回测、模拟盘、实盘三种模式分别配置
- **交易日期范围**：仅在回测模式下显示，模拟盘和实盘使用实时市场
- **Agent 参数**：最大步数、重试次数、延迟、初始资金等
- **Prompt 配置**：每种模式可以设置不同的系统提示词

### 2. 运行策略

#### 开启回测
1. 进入策略详情页面的"配置管理"标签
2. 切换到"回测配置"模式
3. 配置 Prompt、Agent 参数和交易日期范围
4. 点击"保存配置"按钮保存配置
5. 切换到"资产演变"标签页
6. 选择"回测"模式（模式选择器）
7. 点击"🚀 开启回测"按钮启动回测
8. 系统会使用历史数据运行策略，完成后可在同一页面查看结果

#### 开启模拟盘
1. 进入策略详情页面的"配置管理"标签
2. 切换到"模拟盘配置"模式
3. 配置 Prompt 和 Agent 参数（无需设置日期范围）
4. 点击"保存配置"按钮保存配置
5. 切换到"资产演变"标签页
6. 选择"模拟盘"模式（模式选择器）
7. 点击"🎯 开启模拟"按钮启动模拟盘
8. 系统会使用实时市场数据进行模拟交易

#### 开始实盘
1. 进入策略详情页面的"配置管理"标签
2. 切换到"实盘配置"模式
3. 配置 Prompt 和 Agent 参数（无需设置日期范围）
4. 点击"保存配置"按钮保存配置
5. 切换到"资产演变"标签页
6. 选择"实盘"模式（模式选择器）
7. ⚠️ **重要**：点击"⚡ 开始实盘"按钮前，请确保：
   - 已充分测试策略（通过回测和模拟盘验证）
   - 已配置风险控制参数
   - 已准备好承担交易风险
8. 点击"⚡ 开始实盘"按钮，系统会弹出二次确认
9. 确认后系统会使用真实资金执行交易

#### 按钮位置和显示规则
- **按钮位置**：运行按钮位于"资产演变"标签页中，模式选择器下方
- **按钮显示规则**：
  - 选择"回测"模式时，显示"🚀 开启回测"按钮
  - 选择"模拟盘"模式时，显示"🎯 开启模拟"按钮
  - 选择"实盘"模式时，显示"⚡ 开始实盘"按钮
- **使用流程**：配置 → 保存 → 切换到资产演变 → 选择模式 → 点击运行按钮

### 3. AI 思考日志

#### 功能位置
AI 思考日志位于"资产演变"模块下方，便于在查看资产变化时同时查看 AI 的决策过程。

#### 使用方法
1. 进入策略详情页面
2. 切换到"资产演变"标签页
3. 选择运行模式（回测/模拟盘/实盘）
4. 在"AI 思考日志"区域选择日期
5. 查看该日期的完整对话记录

#### 日志内容
- **时间戳**：每条日志的精确时间
- **模型标识**：使用的 AI 模型（signature）
- **对话记录**：
  - 用户查询（蓝色标识）
  - AI 回复（绿色标识）
  - 工具调用结果
  - AI 的推理过程和决策依据

#### 使用场景
- **调试**：查看 AI 为什么做出某个交易决策
- **优化**：分析 AI 的推理过程，优化 Prompt
- **审计**：实盘交易时，记录完整的决策过程用于审计
- **学习**：了解 AI 如何处理市场信息和做出决策

#### 日志存储位置
```
data/data/agent_data/{signature}/log/{date}/log.jsonl
# 或（策略化结构）
data/strategies/{strategy_id}/{mode}/agent_data/log/{date}/log.jsonl
```

### 4. 配置保存和加载

#### 配置保存
1. 在策略详情页面的"配置管理"标签中修改参数
2. 点击"保存配置"按钮
3. 配置会保存到 JSON 文件：`configs/strategies/{strategy_id}/{mode}_config.json`
4. 保存成功后，系统会提示需要重启服务

#### 配置加载
- 页面加载时自动从 JSON 文件读取配置
- 支持三种模式分别保存和加载配置
- 如果配置文件不存在，使用默认值

#### 重启服务
- 修改配置后，点击"重启服务"按钮
- 系统会停止当前运行的策略并重启服务
- 新配置在服务重启后生效

### 5. 交易日期范围配置

#### 设计说明
- **回测模式**：需要设置历史日期范围，用于回测策略
- **模拟盘模式**：使用实时市场，无需设置日期范围
- **实盘模式**：使用实时市场，无需设置日期范围

#### 配置位置
- 仅在"回测配置"模式下显示日期范围输入框
- 模拟盘和实盘模式下，日期范围区域显示提示信息："实时运行，无需设置日期范围"

### 6. 模式切换和结果查看

#### 三种运行模式
- **回测（Backtest）**：
  - 使用历史数据
  - 无资金风险
  - 快速验证策略有效性
  - 需要设置日期范围

- **模拟盘（Simulate）**：
  - 使用实时市场数据
  - 模拟交易执行
  - 无资金风险
  - 验证真实市场反应

- **实盘（Real）**：
  - 使用实时市场数据
  - 真实交易执行
  - 涉及真实资金
  - 需要严格监控和风险控制

#### 结果查看
- **资产演变**：查看资产净值曲线、收益率、回撤等指标
- **投资组合分析**：查看当前持仓、交易记录、资产分布
- **AI 思考日志**：查看每日的决策过程和推理步骤

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

**A:** 修改配置后需要重启服务：
1. 在策略详情页面的"配置管理"中修改配置
2. 点击"保存配置"按钮
3. 点击"重启服务"按钮（保存后自动显示）
4. 或手动重启 `main.py`

### Q3: 配置保存后刷新页面就没了？

**A:** 配置已正确保存到 JSON 文件。如果刷新后看不到，请检查：
1. 浏览器控制台是否有错误
2. 策略 API 是否正常运行（端口 8005）
3. 配置文件是否存在：`configs/strategies/{strategy_id}/{mode}_config.json`

**解决方法：**
- 检查浏览器控制台的网络请求
- 确认策略 API 服务正在运行
- 手动查看配置文件确认是否保存成功

### Q4: AI 思考日志一直显示"加载中..."？

**A:** 可能原因：
1. 策略 API 未运行或无法访问
2. 日志文件路径不正确
3. 网络请求失败

**解决方法：**
1. 检查策略 API 是否运行（端口 8005）
2. 打开浏览器开发者工具（F12），查看 Network 标签中的请求状态
3. 检查日志文件是否存在：`data/data/agent_data/{signature}/log/{date}/log.jsonl`
4. 查看浏览器控制台的错误信息

### Q5: 前端显示的"Trading Period"不更新？

**A:** 前端显示的"Trading Period"是从实际交易数据中提取的，不是从配置文件读取的。如果需要更新，需要：
1. 修改配置中的日期范围
2. 重启服务运行新的交易
3. 前端会自动显示新的交易日期范围

### Q6: 如何区分回测、模拟盘、实盘的结果？

**A:** 前端界面会自动识别并显示：
- **回测**：蓝色标签 "回测"
- **模拟盘**：黄色标签 "模拟盘"
- **实盘**：红色标签 "实盘"

### Q7: 为什么删除策略时提示无法删除？

**A:** 运行中的策略无法删除，需要先停止运行：
1. 如果策略正在回测，等待回测完成
2. 如果策略正在模拟盘或实盘运行，需要先停止运行
3. 然后才能删除策略

### Q8: MCP 服务启动失败？

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

### Q9: 策略 API 无法访问？

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

### Q10: 配置保存到哪里了？

**A:** 配置保存在以下位置：
- **策略配置**：`configs/strategies/{strategy_id}/base_config.json`
- **模式配置**：`configs/strategies/{strategy_id}/{mode}_config.json`（backtest_config.json, simulate_config.json, real_config.json）
- **Prompt 配置**：`configs/strategies/{strategy_id}/prompts/{mode}_prompt.py`

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

---

## 📝 功能更新日志

### v2.0 (2025-11-04)

#### 新增功能
1. **AI 思考日志功能**
   - 在资产演变模块中查看 AI 的完整决策过程
   - 支持按日期查看历史日志
   - 显示用户查询、AI 回复、工具调用结果
   - 支持代码高亮和格式化显示

2. **策略删除功能**
   - 支持删除策略及其所有配置和数据
   - 运行中的策略无法删除（安全检查）
   - 删除前需要二次确认

3. **配置管理模式化**
   - 回测、模拟盘、实盘三种模式分别配置
   - 交易日期范围仅用于回测模式
   - 每种模式可以设置独立的 Prompt

4. **配置持久化**
   - 配置保存到 JSON 文件
   - 刷新页面后自动加载保存的配置
   - 支持三种模式分别保存和加载

5. **重启服务功能**
   - 配置修改后可以一键重启服务
   - 自动停止当前运行的任务
   - 新配置在重启后生效

#### 改进功能
1. **错误处理优化**
   - 改进日志加载的错误处理
   - 更好的错误提示信息
   - 防止界面一直显示"加载中..."

2. **路径兼容性**
   - 支持新旧两种日志路径结构
   - 自动查找日志文件
   - 向后兼容现有数据

#### 修复问题
1. 修复配置保存后刷新页面丢失的问题
2. 修复日志日期选择器一直显示"加载中..."的问题
3. 修复交易日期范围在模拟盘和实盘模式下不应该显示的问题

### v2.1 (2025-11-04)

#### 新增功能
1. **运行状态监控系统**
   - 实时监控策略运行状态（运行中/已完成/失败）
   - 进度条显示（30% → 60% → 100%）
   - 实时日志输出，显示AI的最新思考过程
   - 使用 `psutil` 检查进程运行状态
   - 进程信息持久化到 `logs/{strategy_id}_{mode}_process.json`
   - 前端每2秒自动轮询状态更新

2. **进程管理机制**
   - 保存进程ID、启动时间、配置文件路径
   - 验证进程是否真正运行（检查命令行）
   - 根据进程状态和结果文件判断策略状态
   - 支持检查多个策略的并发运行状态

3. **实时日志显示**
   - 从日志文件读取最新日志内容
   - 自动去重，避免重复显示
   - 时间戳格式化显示
   - 自动滚动到最新日志

4. **状态API端点**
   - `GET /api/strategies/{id}/status/{mode}` - 获取策略运行状态
   - 返回进程ID、运行状态、最新日志、状态消息

#### 改进功能
1. **前端状态显示优化**
   - 运行按钮位置调整到资产演变标签页
   - 按钮显示逻辑基于当前选择的模式
   - 策略启动后自动切换到资产演变标签
   - 页面加载时自动检查是否有正在运行的策略

2. **错误处理增强**
   - 修复 `psutil` 未导入的问题
   - 改进进程检查的错误处理
   - 日志读取失败时的容错处理
   - 前端API请求失败时的错误提示

#### 技术实现
- **后端**: `platform/run_manager.py` 添加 `check_run_status()` 和 `_get_latest_log_entry()` 方法
- **API**: `platform/strategy_api.py` 添加 `/api/strategies/{id}/status/{mode}` 端点
- **前端**: `docs/assets/js/strategy-detail.js` 添加状态监控和日志显示功能
- **UI**: `docs/strategy-detail.html` 添加运行状态容器和进度条

