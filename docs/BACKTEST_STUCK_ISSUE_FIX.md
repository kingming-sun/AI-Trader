# 回测卡住问题修复

## 问题日期
2025-11-11 21:16

## 问题描述

### 症状1: 回测停住
- 回测在第3天(2025-10-06)卡住
- 进程仍在运行（PID: 42351，运行时长: 4分16秒）
- 日志停在：`📤 [DEBUG] Calling agent.ainvoke (Attempt 1/3)...`
- 没有新的输出

### 症状2: 前端显示"回测未启动"
- 进度文件显示 `progress = 8%`
- 实际已处理2天，但前端可能显示未启动或停止

## 根本原因

### ❌ GraphRecursionError

从最新日志发现真正的错误：

```
❌ [DEBUG] Exception in _ainvoke_with_retry (Attempt 1/3):
   Error Type: GraphRecursionError
   Error Message: Recursion limit of 100 reached without hitting a stop condition.
```

**问题分析**：

Agent陷入了**工具调用循环**：
```
Agent → 调用TIME_SERIES_DAILY查价格 
      → 分析结果
      → 再次调用TIME_SERIES_DAILY 
      → 再次分析
      → ...循环100次
      → 触发递归限制
      → GraphRecursionError
```

### 为什么会发生工具调用循环？

1. **提示词不够明确**
   - 原提示词：`Use TIME_SERIES_DAILY tool to query additional stock prices if needed`
   - Agent理解为：可以频繁查询价格来辅助决策

2. **缺少明确的停止信号**
   - 没有明确告诉Agent要在1-2步内完成
   - 没有限制工具调用次数

3. **递归限制设置过低**
   - 默认100次递归对于需要查询多个股票的场景可能不够
   - 但更重要的是要防止无限循环

## 修复方案

### ✅ 修复1: 增加递归限制

**文件**: `agent/base_agent/base_agent.py`

**第366行**（关键修复）：
```python
# 修复前
result = await self.agent.ainvoke(
    {"messages": message}, 
    {"recursion_limit": 100}  # ← 太低！
)

# 修复后
result = await self.agent.ainvoke(
    {"messages": message}, 
    {"recursion_limit": 200}  # ← 增加到200
)
```

### ✅ 修复2: 优化提示词防止过度调用

**文件**: `prompts/agent_prompt.py`

**第31-51行**：
```python
agent_system_prompt = """
Trading assistant for stock portfolio management.

Goal: Maximize returns by analyzing positions and prices, then executing trades via tools.

Date: {date}

Positions: {positions}
Yesterday close: {yesterday_close_price}
Today open: {today_buy_price}

Instructions:
1. Analyze the provided positions and prices above
2. Make trading decisions (buy/sell) if needed
3. **Use TIME_SERIES_DAILY only if you need prices for stocks not shown above**
4. **Avoid querying prices repeatedly - use the data provided**
5. Execute 2-5 trades max per day
6. Output {STOP_SIGNAL} when done (required)

**Important**: Complete your analysis and trading in 1-2 steps. Do not over-analyze.
"""
```

**关键改进**：
- ✅ 明确只在必要时查询额外价格
- ✅ 强调使用已提供的数据
- ✅ 限制每天交易次数（2-5笔）
- ✅ 要求1-2步完成，避免过度分析

### ✅ 修复3: 减少初始显示的价格数据

**文件**: `prompts/agent_prompt.py`

**第223、233-234行**：
```python
# 持仓显示从15个减少到10个
for symbol, shares in list(stock_positions.items())[:10]:

# 价格显示从20个减少到10个
yesterday_close_str = format_price_dict(yesterday_sell_prices, max_items=10)
today_buy_str = format_price_dict(today_buy_price, max_items=10)
```

**原因**：
- 减少初始token使用
- 鼓励Agent基于已有数据做决策
- 确实需要更多数据时才调用工具

## "回测未启动"状态说明

### 前端状态判断逻辑

根据 `platform/run_manager.py` 的 `check_run_status` 函数：

| 条件 | 前端显示 |
|------|---------|
| `progress = 0` | ❌ **未启动** |
| `progress > 0` 且进程运行中 | ▶️ **运行中** |
| `progress > 0` 但进程停止 | ⏸️ **已停止** |
| 有结果文件（asset.json/portfolio.json） | ✅ **已完成** |

### 本次情况
- 进度：8% (2/23天)
- 进程：运行中（PID: 42351）
- 状态：应该显示"运行中"
- 但因为递归错误卡住，实际卡在重试循环中

## 验证步骤

### 1. 停止当前卡住的进程
```bash
kill 42351
```

### 2. 重新运行回测
```bash
cd /Users/qiming.sun/AI-Trader
python main.py /Users/qiming.sun/AI-Trader/configs/runtime_strategy_20251111_211623_backtest.json
```

### 3. 观察日志
应该看到：
```
🔧 Filtered tools: 122 → 5 (kept 4% essential tools)
✅ Yesterday's price fetch complete: 101 from local, 0 from API, 0 missing
✅ Price fetch complete: 101 from local, 0 from API, 0 missing
✅ [DEBUG] Agent.ainvoke completed successfully
✅ Received stop signal, trading session ended
```

### 4. 检查工具调用次数
如果日志中tool messages数量 > 50，说明仍然有过度调用问题。

## 预期效果

### 修复前
```
第1天：成功 ✅
第2天：成功 ✅
第3天：卡住 ❌ (GraphRecursionError after 100 recursions)
```

### 修复后
```
第1天：成功 ✅ (工具调用: 8次)
第2天：成功 ✅ (工具调用: 16次)
第3天：成功 ✅ (工具调用: < 200次)
...
第22天：成功 ✅
回测完成 🎉
```

## 额外优化建议

### 如果仍然出现递归问题

#### 方案A: 进一步减少工具
```python
essential_tool_names = {
    'buy', 'sell',      # 只保留交易工具
    'add', 'multiply'   # 数学工具
}
# 移除 TIME_SERIES_DAILY，完全依赖提示词中的价格
```

#### 方案B: 增加更多价格数据到提示词
```python
# 从10个增加到30个
yesterday_close_str = format_price_dict(yesterday_sell_prices, max_items=30)
today_buy_str = format_price_dict(today_buy_price, max_items=30)
```

#### 方案C: 添加工具调用计数器
在 `_ainvoke_with_retry` 中添加：
```python
if len(tool_messages) > 50:
    print("⚠️  Warning: Excessive tool calls detected, forcing stop")
    break
```

## 技术细节

### LangGraph 递归限制
- **默认值**: 100
- **用途**: 防止Agent陷入无限循环
- **合理范围**: 50-500
  - 简单任务: 50-100
  - 复杂分析: 100-200
  - 高度交互: 200-500

### 工具调用模式
**正常模式**（理想）：
```
Step 1: Agent分析 → 调用buy工具2-3次 → 输出STOP_SIGNAL
```

**问题模式**（本次bug）：
```
Step 1: Agent分析 → 调用TIME_SERIES_DAILY(NVDA)
Step 2: Agent分析 → 调用TIME_SERIES_DAILY(MSFT)
Step 3: Agent分析 → 调用TIME_SERIES_DAILY(AAPL)
...
Step 100: Agent分析 → GraphRecursionError!
```

## 状态
- [x] 问题诊断完成
- [x] 递归限制修复
- [x] 提示词优化
- [x] 数据量优化
- [ ] 测试验证（需要重新运行）

## 下一步
1. 停止当前卡住的进程 (`kill 42351`)
2. 重新启动回测
3. 观察第3天是否能正常完成
4. 监控工具调用次数
5. 如果仍有问题，考虑方案A（移除TIME_SERIES_DAILY工具）

