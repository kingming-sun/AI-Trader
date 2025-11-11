# Alpha Vantage MCP 工具说明

## 📋 Alpha Vantage MCP 提供的工具类别

Alpha Vantage MCP 服务器提供了丰富的金融数据工具，涵盖以下主要类别：

### 1. **核心股票数据（Core Stock APIs）**
- `TIME_SERIES_INTRADAY` - 日内分钟级股票数据
- `TIME_SERIES_DAILY` - 日线股票数据
- `TIME_SERIES_WEEKLY` - 周线股票数据
- `TIME_SERIES_MONTHLY` - 月线股票数据
- `GLOBAL_QUOTE` - 实时全球股票报价
- `SYMBOL_SEARCH` - 股票代码搜索

### 2. **技术指标（Technical Indicators）**
- `RSI` - 相对强弱指标
- `MACD` - 移动平均收敛散度
- `BBANDS` - 布林带
- `SMA` - 简单移动平均
- `EMA` - 指数移动平均
- `STOCH` - 随机指标
- `ADX` - 平均趋向指标
- `CCI` - 商品通道指数
- `AROON` - 阿隆指标
- `OBV` - 能量潮指标
- 以及其他 50+ 种技术指标

### 3. **基本面数据（Fundamental Data）**
- `OVERVIEW` - 公司概况
- `INCOME_STATEMENT` - 利润表
- `BALANCE_SHEET` - 资产负债表
- `CASH_FLOW` - 现金流量表
- `EARNINGS` - 盈利数据
- `LISTING_STATUS` - 上市状态

### 4. **Alpha 智能（Alpha Intelligence）**
- `NEWS_SENTIMENT` - 新闻情绪分析
- `EARNINGS_CALL_TRANSCRIPT` - 财报电话会议记录
- `TOP_GAINERS_LOSERS` - 热门涨跌股
- `IPO_CALENDAR` - IPO 日历

### 5. **期权数据（Options Data APIs）**
- `REALTIME_OPTIONS` - 实时期权数据
- `HISTORICAL_OPTIONS` - 历史期权数据

### 6. **外汇（Forex）**
- `FX_INTRADAY` - 日内外汇数据
- `FX_DAILY` - 日线外汇数据
- `FX_WEEKLY` - 周线外汇数据
- `FX_MONTHLY` - 月线外汇数据
- `CURRENCY_EXCHANGE_RATE` - 实时汇率

### 7. **加密货币（Cryptocurrencies）**
- `CRYPTO_INTRADAY` - 日内加密货币数据
- `DIGITAL_CURRENCY_DAILY` - 日线加密货币数据
- `DIGITAL_CURRENCY_WEEKLY` - 周线加密货币数据
- `DIGITAL_CURRENCY_MONTHLY` - 月线加密货币数据

### 8. **商品（Commodities）**
- `WTI` - 西德克萨斯中质原油
- `BRENT` - 布伦特原油
- `NATURAL_GAS` - 天然气
- `COPPER` - 铜
- `ALUMINUM` - 铝
- `WHEAT` - 小麦
- `CORN` - 玉米
- `COTTON` - 棉花
- `SUGAR` - 糖

### 9. **经济指标（Economic Indicators）**
- `GDP` - 国内生产总值
- `REAL_GDP` - 实际 GDP
- `REAL_GDP_PER_CAPITA` - 人均实际 GDP
- `CPI` - 消费者物价指数
- `INFLATION` - 通货膨胀率
- `UNEMPLOYMENT` - 失业率
- `FEDERAL_FUNDS_RATE` - 联邦基金利率
- `TREASURY_YIELD` - 国债收益率
- `DURABLES` - 耐用品订单
- `NONFARM_PAYROLL` - 非农就业数据

## 🔧 `get_tools()` 的工作原理

### 这是 MCP 协议的标准功能，不是 Alpha Vantage 特有的

`self.tools = await self.client.get_tools()` 中的 `get_tools()` 方法来自 `langchain_mcp_adapters` 库的 `MultiServerMCPClient` 类，它实现了 **MCP (Model Context Protocol) 协议**的标准功能。

**关键点：**
- ✅ `get_tools()` 是 **MCP 协议的标准方法**，所有符合 MCP 协议的服务器都支持
- ✅ 不是 Alpha Vantage 特有的功能，而是 MCP 协议定义的标准工具发现机制
- ✅ 任何 MCP 服务器（本地或远程）都会响应工具列表请求
- ✅ `MultiServerMCPClient` 会向所有配置的 MCP 服务器发送工具列表请求

**工作流程：**
```
MultiServerMCPClient.get_tools()
    ↓
向所有 MCP 服务器发送工具列表请求
    ├─→ 本地 Math MCP 服务器 → 返回 [add, multiply]
    ├─→ 本地 Trade MCP 服务器 → 返回 [buy, sell]
    └─→ 远程 Alpha Vantage MCP 服务器 → 返回 [TIME_SERIES_DAILY, RSI, MACD, ...]
    ↓
合并所有工具列表
    ↓
返回完整的工具列表给 Agent
```

## 🤖 AI 如何自动发现这些工具

### MCP 协议的工作原理

MCP (Model Context Protocol) 是一个标准化的协议，允许 AI agent 自动发现和使用工具。工作流程如下：

```
┌─────────────┐        1. 连接请求         ┌──────────────────┐
│             │ ─────────────────────────> │                  │
│ AI Agent    │                            │ Alpha Vantage    │
│             │ <───────────────────────── │ MCP Server       │
│             │    2. 工具列表 + 描述      │                  │
└─────────────┘                            └──────────────────┘
       │                                            │
       │ 3. 自动注册所有工具                          │
       │                                            │
       v                                            v
┌─────────────────────────────────────────────────────┐
│  Agent 工具注册表                                    │
│  - TIME_SERIES_DAILY (获取日线数据)                 │
│  - RSI (计算相对强弱指标)                           │
│  - MACD (计算MACD指标)                              │
│  - GLOBAL_QUOTE (获取实时报价)                      │
│  - ... (所有其他工具)                               │
└─────────────────────────────────────────────────────┘
```

### 1. **工具发现过程**

当 AI agent 初始化时，会执行以下步骤：

```python
# 1. 连接到 Alpha Vantage MCP 服务器
self.client = MultiServerMCPClient(self.mcp_config)

# 2. 自动获取所有可用工具
self.tools = await self.client.get_tools()
# 返回所有工具的列表，包括：
# - 工具名称
# - 工具描述
# - 参数定义
# - 返回类型

# 3. 自动注册到 LangChain Agent
self.agent = create_agent(
    self.model,
    tools=self.tools,  # 所有工具自动注册
    system_prompt=...
)
```

### 2. **工具信息包含的内容**

每个工具都包含以下信息，AI 可以自动理解：

- **工具名称**：如 `TIME_SERIES_DAILY`
- **工具描述**：详细说明工具的功能和用途
- **参数定义**：
  - `symbol` - 股票代码（如 "AAPL"）
  - `interval` - 时间间隔（如 "1min", "5min", "daily"）
  - `outputsize` - 输出大小（"compact" 或 "full"）
- **返回类型**：工具返回的数据结构
- **示例用法**：如何使用该工具

### 3. **AI 如何选择工具**

AI agent 通过以下方式自动选择和使用工具：

1. **理解用户意图**：
   - 用户："获取 AAPL 的日线数据"
   - AI 理解：需要使用 `TIME_SERIES_DAILY` 工具

2. **匹配工具功能**：
   - AI 查看所有已注册工具的描述
   - 找到最匹配的工具（`TIME_SERIES_DAILY`）

3. **自动调用工具**：
   ```python
   # AI 自动生成工具调用
   result = await tool_TIME_SERIES_DAILY(
       symbol="AAPL",
       outputsize="compact"
   )
   ```

4. **处理返回结果**：
   - AI 接收工具返回的数据
   - 根据上下文继续推理或回答用户

### 4. **实际代码示例**

在我们的项目中，工具自动发现和注册的代码位于：

```python
# agent/base_agent/base_agent.py

async def initialize(self) -> None:
    # 1. 连接到所有 MCP 服务器（包括 Alpha Vantage）
    self.client = MultiServerMCPClient(self.mcp_config)
    
    # 2. 自动获取所有工具
    self.tools = await self.client.get_tools()
    # 此时 self.tools 包含：
    # - Math 工具（add, multiply）
    # - Trade 工具（buy, sell）
    # - Alpha Vantage 工具（TIME_SERIES_DAILY, RSI, MACD, ...）
    
    # 3. 创建 Agent，所有工具自动注册
    self.agent = create_agent(
        self.model,
        tools=self.tools,  # 所有工具都在这里
        system_prompt=...
    )
```

### 5. **工具调用流程**

```
用户查询
    ↓
AI Agent 分析意图
    ↓
选择合适工具（自动匹配）
    ↓
调用工具（自动执行）
    ↓
处理返回结果
    ↓
继续推理或回答用户
```

## 🔍 如何查看已注册的工具

在 agent 初始化时，会显示详细的工具信息：

```
🚀 Initializing agent: test_agent
📡 Connecting to MCP servers: ['math', 'trade', 'alphavantage']
✅ Loaded 150+ MCP tools from all servers
📋 Tools by source:
   alphavantage: 120 tools
      Examples: TIME_SERIES_DAILY, TIME_SERIES_INTRADAY, RSI, MACD, BBANDS, SMA, EMA, GLOBAL_QUOTE, ...
   math: 2 tools
      Examples: add, multiply
   trade: 2 tools
      Examples: buy, sell
✅ Alpha Vantage MCP tools loaded: 120 tools
🤖 Creating agent with 124 registered tools (auto-selection enabled)
```

## 📚 参考资源

- [Alpha Vantage MCP GitHub 仓库](https://github.com/alphavantage/alpha_vantage_mcp)
- [Alpha Vantage MCP Agent 示例](https://github.com/alphavantage/alpha_vantage_mcp/blob/main/examples/agent/README.md)
- [Alpha Vantage API 文档](https://www.alphavantage.co/documentation/)
- [MCP 协议规范](https://modelcontextprotocol.io/)

## 💡 关键要点

1. **无需手动配置**：所有 Alpha Vantage 工具都会自动发现和注册
2. **自动选择**：AI 会根据任务和上下文自动选择最合适的工具
3. **动态更新**：如果 Alpha Vantage 添加新工具，下次连接时会自动发现
4. **统一接口**：所有工具通过统一的 MCP 协议访问，无需关心底层实现

