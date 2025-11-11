# Token超限问题激进修复方案

## 问题现状

### 第一次修复后仍然超限
- ✅ 工具过滤：122 → 15个
- ✅ 本地数据读取成功
- ❌ Token使用：297,918 tokens (超限 2.27倍！)

### 根本原因
**Alpha Vantage工具的schema极其庞大**

每个Alpha Vantage MCP工具包含：
- 详细的参数定义（symbol, function, interval, outputsize, datatype, apikey等）
- 完整的JSON schema
- 详细的描述文本
- 示例和错误处理说明

**估算**：
- 每个Alpha Vantage工具：约 20k tokens
- 15个工具总计：约 300k tokens
- 远超 131k 限制！

## 激进修复方案

### 1️⃣ 极简工具集（122 → 5个）

只保留**绝对必需**的5个核心工具：

```python
essential_tool_names = {
    # Trading tools (absolutely required)
    'buy', 'sell',
    # ONLY ONE price data tool (most essential)
    'TIME_SERIES_DAILY',
    # Math tools (minimal)
    'add', 'multiply'
}
```

**移除的工具**（牺牲功能换取可用性）：
- ❌ GLOBAL_QUOTE
- ❌ TIME_SERIES_DAILY_ADJUSTED
- ❌ RSI, MACD, SMA, EMA, BBANDS（技术指标）
- ❌ SYMBOL_SEARCH, MARKET_STATUS, NEWS_SENTIMENT（市场数据）

### 2️⃣ 极简价格数据显示（20 → 10个）

```python
# 修改前
yesterday_close_str = format_price_dict(yesterday_sell_prices, max_items=20)
today_buy_str = format_price_dict(today_buy_price, max_items=20)
positions: 显示前15个

# 修改后
yesterday_close_str = format_price_dict(yesterday_sell_prices, max_items=10)
today_buy_str = format_price_dict(today_buy_price, max_items=10)
positions: 显示前10个
```

Agent可以通过 TIME_SERIES_DAILY 工具查询更多股票价格。

### 3️⃣ 极简系统提示词（约70%压缩）

**修改前**（约500 tokens）：
```
You are a stock fundamental analysis trading assistant.

Your goals are:
- Think and reason by calling available tools.
- You need to think about the prices of various stocks and their returns.
- Your long-term goal is to maximize returns through this portfolio.
...（详细说明）

Thinking standards:
- Clearly show key intermediate steps:
  - Read input of yesterday's positions and today's prices
  - Update valuation and adjust weights for each target
...
```

**修改后**（约150 tokens）：
```
Trading assistant for stock portfolio management.

Goal: Maximize returns by analyzing positions and prices, then executing trades via tools.

Info:
Date: {date}
Positions: {positions}
Yesterday close: {yesterday_close_price}
Today open: {today_buy_price}

Instructions:
- Analyze positions and prices
- Execute trades using buy/sell tools
- Use TIME_SERIES_DAILY tool to query additional stock prices if needed
- Output {STOP_SIGNAL} when done
```

## Token使用预估

| 组成部分 | 修复前 | 修复后 | 节省 |
|---------|--------|--------|------|
| 工具schema | ~300k (15工具) | ~100k (5工具) | -200k |
| 系统提示词 | ~500 | ~150 | -350 |
| 价格数据 | ~10k (20股) | ~5k (10股) | -5k |
| 其他 | ~5k | ~5k | 0 |
| **总计** | **~316k** ❌ | **~110k** ✅ | **-206k** |

**预期结果**：110k < 131k ✅ 应该能够正常运行

## 修改文件

### 1. `/Users/qiming.sun/AI-Trader/agent/base_agent/base_agent.py`

**第224-234行**：工具过滤逻辑
```python
essential_tool_names = {
    'buy', 'sell',           # 交易必需
    'TIME_SERIES_DAILY',     # 唯一的价格查询工具
    'add', 'multiply'        # 数学计算
}
```

### 2. `/Users/qiming.sun/AI-Trader/prompts/agent_prompt.py`

**第31-50行**：极简系统提示词

**第223-227行**：持仓显示限制（10个）
```python
for symbol, shares in list(stock_positions.items())[:10]:
```

**第231-235行**：价格数据限制（10个）
```python
yesterday_close_str = format_price_dict(yesterday_sell_prices, max_items=10)
today_buy_str = format_price_dict(today_buy_price, max_items=10)
```

## 权衡与影响

### ✅ 优势
1. **可用性**：Token使用降低到限制以下
2. **本地数据**：已修复，无需重复API调用
3. **核心功能保留**：交易和价格查询功能完整

### ⚠️ 限制
1. **技术指标**：无法直接使用RSI、MACD等（可通过自定义计算）
2. **市场数据**：无新闻、市场状态查询
3. **价格显示**：初始只显示10个股票（可通过工具查询更多）

### 🎯 设计理念
- **最小可用集**：只保留绝对必需的功能
- **按需查询**：Agent可以主动调用 TIME_SERIES_DAILY 获取更多数据
- **功能vs可用性**：牺牲高级功能换取系统可运行

## 备选方案（如果仍然超限）

### Plan B: 完全移除 TIME_SERIES_DAILY
如果5个工具仍然超限，说明单个工具schema > 30k tokens，此时：

```python
essential_tool_names = {
    'buy', 'sell',      # 只保留交易工具
    'add', 'multiply'   # 数学工具
}
```

**影响**：
- Agent无法主动查询价格
- 必须依赖系统提示词中的价格数据
- 需要在提示词中增加显示的股票数量（从10个→30个）

### Plan C: 使用更大context的模型
如果功能需求无法妥协：
- 切换到 `deepseek-chat-v3` (支持更大context)
- 或使用 GPT-4 Turbo (128k context)
- 或使用 Claude-3.5-Sonnet (200k context)

## 验证步骤

1. **重新运行回测**：
```bash
cd /Users/qiming.sun/AI-Trader
python main.py
```

2. **检查日志**：
```
🔧 Filtered tools: 122 → 5 (kept 4% essential tools)
   This reduces context usage and prevents token limit errors
```

3. **确认token使用**：
- 应该看到成功执行，没有 BadRequestError
- Token使用应该 < 131,072

4. **监控功能**：
- 交易功能正常（buy/sell）
- Agent能够分析持仓
- Agent能够执行交易决策

## 状态
- [x] 问题诊断完成
- [x] 激进修复完成
- [ ] 测试验证（待运行）

## 总结

这是一个**激进但必要**的修复方案。通过三重优化（工具、数据、提示词），我们将token使用从316k降低到约110k，应该能够在131k限制内正常运行。

如果用户需要更多功能（如技术指标），可以考虑：
1. 使用更大context的模型
2. 在本地实现技术指标计算
3. 分批处理股票（不一次性分析所有101只）

