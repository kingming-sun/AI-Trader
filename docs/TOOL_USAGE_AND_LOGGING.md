# 工具使用和日志记录说明

## 📝 AI 日志中的工具使用记录

### 当前日志记录功能

AI Agent 现在会在日志中**详细记录**所有工具的使用情况，包括：

1. **工具名称**：使用的具体工具名称（如 `TIME_SERIES_DAILY`、`buy`、`add` 等）
2. **工具调用ID**：每次工具调用的唯一标识符
3. **工具参数**：传递给工具的所有参数（如 `symbol="AAPL"`, `date="2025-01-15"` 等）
4. **工具结果**：工具执行后返回的结果

### 日志格式

日志文件位置：`data/strategies/{strategy_id}/{mode}/agent_data/log/{date}/log.jsonl`

每条日志记录包含：
```json
{
  "timestamp": "2025-01-15T10:30:00.123456",
  "signature": "model_name",
  "new_messages": [
    {
      "role": "assistant",
      "content": "AI 的回复内容..."
    },
    {
      "role": "system",
      "content": "🔧 Tools Used: [\n  {\n    \"tool_name\": \"TIME_SERIES_DAILY\",\n    \"tool_call_id\": \"call_abc123\",\n    \"arguments\": {\n      \"symbol\": \"AAPL\",\n      \"interval\": \"daily\",\n      \"outputsize\": \"compact\"\n    }\n  },\n  {\n    \"tool_name\": \"buy\",\n    \"tool_call_id\": \"call_xyz789\",\n    \"arguments\": {\n      \"symbol\": \"AAPL\",\n      \"amount\": 10\n    }\n  }\n]"
    },
    {
      "role": "user",
      "content": "Tool results: {...工具返回的结果...}"
    }
  ]
}
```

### 查看日志

1. **通过前端界面**：
   - 进入策略详情页面
   - 选择日期
   - 查看 "AI 思考日志" 部分

2. **直接查看日志文件**：
   ```bash
   cat data/strategies/{strategy_id}/backtest/agent_data/log/{date}/log.jsonl
   ```

## 📊 回测时获取行情的工具

### 当前架构

**回测时，Agent 使用的是 Alpha Vantage MCP 服务**，而不是本地价格工具。

### 工具来源

1. **Alpha Vantage MCP 服务**（远程）：
   - 提供 `TIME_SERIES_DAILY`、`TIME_SERIES_INTRADAY`、`GLOBAL_QUOTE` 等工具
   - 这些工具直接通过 Alpha Vantage MCP 服务器调用
   - Agent 会自动选择并使用这些工具

2. **本地 MCP 服务**（已移除）：
   - `tool_get_price_local.py` 和 `tool_get_price_enhanced.py` 已不再作为 MCP 服务运行
   - 这些文件仍然存在，但不在 MCP 服务列表中
   - 它们内部调用的是 Alpha Vantage REST API（`requests.get`），而不是 MCP 协议

### Agent 配置

Agent 初始化时的 MCP 配置（`agent/base_agent/base_agent.py`）：

```python
config = {
    "math": {
        "transport": "streamable_http",
        "url": "http://localhost:8000/mcp",
    },
    "trade": {
        "transport": "streamable_http",
        "url": "http://localhost:8002/mcp",
    },
    "alphavantage": {
        "transport": "http",
        "url": "https://mcp.alphavantage.co/mcp?apikey={API_KEY}",
    }
}
```

### 数据获取流程

回测时，Agent 获取行情数据的流程：

```
Agent 需要获取股票价格
    ↓
自动选择 Alpha Vantage MCP 工具（如 TIME_SERIES_DAILY）
    ↓
通过 MCP 协议调用 Alpha Vantage MCP 服务器
    ↓
Alpha Vantage MCP 服务器调用其 API
    ↓
返回数据给 Agent
    ↓
Agent 记录工具使用情况到日志
```

### 验证方法

1. **查看 Agent 初始化日志**：
   ```
   ✅ Alpha Vantage MCP server configured (replaces LocalPrices and Search)
   ✅ Alpha Vantage MCP tools loaded: 120 tools
   ```

2. **查看日志中的工具使用记录**：
   - 日志中会显示使用的工具名称
   - 如果看到 `TIME_SERIES_DAILY`、`GLOBAL_QUOTE` 等，说明使用的是 Alpha Vantage MCP
   - 如果看到 `get_price_local` 或 `get_price_enhanced`，说明可能还在使用旧工具（不应该出现）

3. **检查 MCP 服务状态**：
   - 访问服务状态页面
   - 确认只有 Math、Trade 和 Alpha Vantage MCP 服务
   - 不应该看到 LocalPrices 或 EnhancedPrices 服务

## 🔍 工具使用示例

### 示例 1：获取股票价格

**Agent 日志记录**：
```json
{
  "role": "system",
  "content": "🔧 Tools Used: [\n  {\n    \"tool_name\": \"TIME_SERIES_DAILY\",\n    \"tool_call_id\": \"call_123\",\n    \"arguments\": {\n      \"symbol\": \"AAPL\",\n      \"outputsize\": \"compact\"\n    }\n  }\n]"
}
```

**说明**：
- 工具名称：`TIME_SERIES_DAILY`（来自 Alpha Vantage MCP）
- 参数：`symbol="AAPL"`, `outputsize="compact"`
- 来源：Alpha Vantage MCP 服务器

### 示例 2：执行交易

**Agent 日志记录**：
```json
{
  "role": "system",
  "content": "🔧 Tools Used: [\n  {\n    \"tool_name\": \"buy\",\n    \"tool_call_id\": \"call_456\",\n    \"arguments\": {\n      \"symbol\": \"AAPL\",\n      \"amount\": 10\n    }\n  }\n]"
}
```

**说明**：
- 工具名称：`buy`（来自本地 Trade MCP 服务）
- 参数：`symbol="AAPL"`, `amount=10`
- 来源：本地 TradeTools MCP 服务（端口 8002）

## 📋 总结

1. **日志记录**：✅ AI 会在日志中详细记录所有工具的使用情况（工具名称、参数、结果）

2. **回测获取行情**：✅ 使用的是 **Alpha Vantage MCP 服务**，而不是本地价格工具

3. **工具来源**：
   - 价格数据：Alpha Vantage MCP（`TIME_SERIES_DAILY` 等）
   - 交易执行：本地 TradeTools MCP（`buy`、`sell`）
   - 数学计算：本地 Math MCP（`add`、`multiply`）

4. **查看方式**：
   - 前端：策略详情页面 → 选择日期 → AI 思考日志
   - 后端：查看 `log.jsonl` 文件中的 `🔧 Tools Used` 记录

