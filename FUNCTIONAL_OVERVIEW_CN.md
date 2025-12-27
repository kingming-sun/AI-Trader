# AI-Trader 功能详解文档

## 1. 项目概述

**AI-Trader** 是一个全自动化的 AI 股票交易代理系统，旨在构建一个让多个大语言模型（LLM）在金融市场中同台竞技的实验平台。与传统基于规则（如均线、因子）的量化交易不同，AI-Trader 中的交易决策完全由 AI 代理（Agent）通过分析市场数据、阅读新闻和自行推理后自主做出。

核心理念：**100% AI 自主决策，零人工干预，纯工具驱动架构。**

## 2. 核心功能特性

### 2.1 多模型竞技场 (Multi-Model Arena)
- **多模型支持**：系统支持同时运行多个不同的 LLM（如 GPT-4, Claude-3.5, DeepSeek, Qwen 等）。
- **公平竞争**：所有模型在相同的初始资金（默认 $10,000）、相同的时间段和相同的市场环境下进行交易。
- **独立账户**：每个模型拥有独立的持仓记录和资金账户，互不干扰。

### 2.2 全自主交易决策
- **无预设策略**：系统不内置任何硬编码的交易逻辑（如“RSI > 70 卖出”）。
- **思维链推理**：AI 代理通过“思考-行动-观察”的循环（ReAct 模式），自主决定查询哪些数据、计算哪些指标，并最终下达买卖指令。
- **自我反思**：支持长达 30 步的推理步骤，允许 AI 在下单前进行反复验证和风险评估。

### 2.3 历史回放与防未来函数 (Backtesting & Anti-Lookahead)
- **时间旅行机制**：系统通过严格的时间控制，模拟历史上的每一天。
- **数据隔离**：在回测模式下，AI 只能访问“当前模拟日期”及之前的数据。未来的价格、新闻和财报数据对 AI 严格不可见，确保回测结果的真实性。

### 2.4 可视化与分析
- **实时仪表板**：提供 Web 界面展示收益率曲线、持仓分布和模型排行榜。
- **详细日志**：完整记录 AI 的每一次 API 调用、思维过程（Thought Process）和工具返回结果，便于研究人员分析 AI 的决策逻辑。

---

## 3. 系统架构

系统采用模块化的 **MCP (Model Context Protocol)** 架构，将“大脑”（LLM）与“手眼”（工具）分离。

### 3.1 核心组件

1.  **Agent (智能代理)**
    *   **BaseAgent**: 系统的核心类，负责维护上下文、管理 Token 限制、处理 API 重试和错误恢复。
    *   它不直接包含业务逻辑，而是作为一个编排器，将 LLM 与 MCP 工具连接起来。

2.  **MCP Toolchain (工具链)**
    *   系统通过 MCP 协议挂载多种工具，赋予 AI 操作能力：
    *   **交易工具 (Trade Tools)**: `buy()` (买入), `sell()` (卖出), `get_positions()` (查询持仓)。
    *   **市场数据工具 (Market Data Tools)**:
        *   `get_price_local`: 从本地数据库读取历史 OHLCV 数据。
        *   `Alpha Vantage`: 集成外部 API，提供技术指标（MACD, RSI, Bollinger Bands 等）。
    *   **数学工具 (Math Tools)**: `add`, `multiply` 等，辅助 AI 进行精确的财务计算（避免 LLM 的算术幻觉）。
    *   **搜索工具 (Search Tools)**: (如集成 Jina AI) 用于检索实时新闻和市场情绪分析。

3.  **Data Layer (数据层)**
    *   **基础数据**: 纳斯达克 100 成分股的日线/分钟线数据。
    *   **交易记录**: JSONL 格式存储的每日持仓 (`position.jsonl`) 和决策日志 (`log.jsonl`)。

---

## 4. 工作流程 (Workflow)

### 4.1 初始化阶段
1.  **配置加载**: 读取 `configs/*.json`，确定回测时间范围、初始资金和启用的模型列表。
2.  **环境准备**: 初始化数据目录，为每个模型建立独立的日志路径。
3.  **MCP 连接**: 启动并连接所有配置的 MCP 服务（Local, Math, Trade 等）。

### 4.2 每日交易循环 (Daily Loop)
系统按时间顺序遍历回测范围内的每一个交易日：

1.  **唤醒 (Wake Up)**: 系统将日期设定为“当前模拟日期”，并向 Agent 发送指令：“Please analyze and update today's positions.”
2.  **推理与执行 (Reasoning & Execution)**:
    *   Agent 进入 ReAct 循环。
    *   **Step 1**: 观察当前持仓和现金。
    *   **Step 2**: 调用 `TIME_SERIES_DAILY` 等工具查看重点关注股票的走势。
    *   **Step 3**: 调用 `RSI`, `MACD` 等工具进行技术分析。
    *   **Step 4**: (可选) 搜索相关新闻。
    *   **Step 5**: 综合信息，决定买入或卖出，调用 `buy/sell` 工具。
3.  **结算 (Settlement)**:
    *   执行交易指令，更新持仓文件。
    *   计算当日盈亏。
    *   将完整的交互日志写入 `log.jsonl`。

### 4.3 结果生成
回测结束后，系统自动调用分析模块生成以下报告：
*   `asset_evolution.json`: 资产净值随时间的变化曲线。
*   `portfolio.json`: 最终投资组合构成。
*   `trades.json`: 完整的交易流水清单。

---

## 5. 目录结构说明

```text
AI-Trader/
├── main.py                 # 程序入口，负责调度整个回测流程
├── agent/
│   └── base_agent/         # Agent 基类，处理 LLM 交互和 MCP 连接
├── agent_tools/            # 本地 MCP 工具实现（交易、数学、搜索等）
├── configs/                # 配置文件（策略配置、模型配置）
├── data/                   # 数据存储
│   ├── daily_prices_*.json # 原始股票数据
│   └── strategies/         # 回测结果输出目录（按策略ID/模型名分类）
├── docs/                   # 前端可视化仪表板代码
└── tools/                  # 通用工具函数库
```

## 6. 扩展开发指南

### 添加新模型
在 `configs/` 下的配置文件中，在 `models` 列表中添加新的模型配置（需支持 OpenAI 兼容接口）：
```json
{
  "name": "deepseek-v3",
  "basemodel": "deepseek/deepseek-chat",
  "signature": "deepseek-v3",
  "enabled": true,
  "openai_base_url": "...",
  "openai_api_key": "..."
}
```

### 添加新工具
1.  在 `agent_tools/` 中编写新的 Python 脚本实现工具逻辑。
2.  使用 `@mcp.tool` 装饰器注册。
3.  在 `agent_tools/start_mcp_services.py` 中添加服务启动项。
4.  `BaseAgent` 会自动发现并挂载新工具。
