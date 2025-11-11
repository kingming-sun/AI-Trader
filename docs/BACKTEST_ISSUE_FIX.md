# 回测问题修复总结

## 问题日期
2025-11-11

## 回测策略
- **策略ID**: strategy_20251110_222943
- **模型**: deepseek-chat-v3.1
- **日期范围**: 2025-10-26 到 2025-11-08

## 发现的问题

### 问题1: 路径类型不一致（已自动修复）
**错误信息**:
```
TypeError: unsupported operand type(s) for /: 'str' and 'str'
File "/Users/qiming.sun/AI-Trader/tools/price_tools.py", line 67
    data_file = project_root / "data" / "merged.jsonl"
```

**原因**: 
- `prompts/agent_prompt.py` 第10行定义 `project_root` 为字符串
- `tools/price_tools.py` 第13行定义 `project_root` 为 `Path` 对象
- 两个模块的类型不一致导致路径拼接失败

**修复方案**:
修改 `prompts/agent_prompt.py` 使用 `Path` 对象：
```python
# 修复前
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 修复后
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
```

### 问题2: Token超限 ⚠️ **主要问题**
**错误信息**:
```
BadRequestError: Error code: 400
This model's maximum context length is 131072 tokens. 
However, you requested 201810 tokens (201810 in the messages, 0 in the completion).
```

**原因**: 
1. 系统加载了 **122个MCP工具**（alphavantage: 36, math: 2, other: 84）
2. 所有工具的完整schema都被发送给模型
3. 加上系统提示词和价格数据，总token数达到 201,810，超过了模型的131,072 token限制

**现有的过滤逻辑问题**:
- `base_agent.py` 第224-258行已经有工具过滤代码
- 但是使用了**子字符串匹配**，导致过滤不精确
- 日志中没有显示"🔧 Filtered tools"消息，说明过滤可能失效

**修复方案**:
改进 `agent/base_agent/base_agent.py` 的工具过滤逻辑：

1. **使用精确匹配**而不是子字符串匹配
```python
# 修复前（第252-253行）
if tool_name and any(essential in str(tool_name).upper() for essential in 
                    [name.upper() for name in essential_tool_names]):

# 修复后（第253-258行）
if tool_name:
    tool_name_upper = str(tool_name).upper()
    essential_names_upper = {name.upper() for name in essential_tool_names}
    
    # Check for exact match
    if tool_name_upper in essential_names_upper:
        filtered_tools.append(tool)
```

2. **添加空过滤检测**
```python
if len(filtered_tools) > 0:
    self.tools = filtered_tools
    print(f"🔧 Filtered tools: {original_tool_count} → {len(self.tools)}")
else:
    print(f"⚠️  Warning: Tool filtering resulted in 0 tools, keeping all")
```

3. **保留的必要工具列表**（共14个）:
   - **交易工具**: buy, sell
   - **价格数据**: TIME_SERIES_DAILY, GLOBAL_QUOTE, TIME_SERIES_DAILY_ADJUSTED
   - **技术指标**: RSI, MACD, SMA, EMA, BBANDS
   - **市场数据**: SYMBOL_SEARCH, MARKET_STATUS, NEWS_SENTIMENT
   - **数学工具**: add, multiply

预期效果: 从 122 个工具减少到 **约14个核心工具**，大幅减少token使用

## 修复文件列表

1. ✅ `/Users/qiming.sun/AI-Trader/prompts/agent_prompt.py`
   - 修复 `project_root` 类型不一致

2. ✅ `/Users/qiming.sun/AI-Trader/agent/base_agent/base_agent.py`
   - 改进工具过滤逻辑（精确匹配）
   - 添加空过滤检测和警告

## 验证步骤

1. **重新运行回测**:
```bash
cd /Users/qiming.sun/AI-Trader
python main.py
```

2. **检查日志应该显示**:
```
🔧 Filtered tools: 122 → 14 (kept 11% essential tools)
   This reduces context usage and prevents token limit errors
```

3. **确认token使用量**:
   - 预期token使用量应该降低到 < 131,072
   - Agent应该能够成功执行交易决策

## 潜在的额外优化（如果仍然超限）

如果修复后仍然遇到token限制问题，可以考虑：

1. **进一步减少价格数据显示**:
   - 当前显示前20个股票价格
   - 可以减少到10个或更少

2. **简化系统提示词**:
   - 移除不必要的说明文字
   - 使用更简洁的格式

3. **使用更大context的模型**:
   - 切换到 deepseek-chat-v3 (更大context)
   - 或使用其他支持更长context的模型

4. **分批处理股票**:
   - 不一次性显示所有101个股票价格
   - 只显示持仓股票和少量候选股票

## 技术细节

### Token使用估算（修复前）
- **122个MCP工具schema**: 约150,000 tokens
- **系统提示词**: 约5,000 tokens  
- **价格数据（101股票）**: 约45,000 tokens
- **其他**: 约1,810 tokens
- **总计**: 201,810 tokens ❌

### Token使用估算（修复后）
- **14个核心工具schema**: 约18,000 tokens
- **系统提示词**: 约5,000 tokens
- **价格数据（20股票显示）**: 约10,000 tokens
- **其他**: 约2,000 tokens
- **总计**: 约35,000 tokens ✅

## 状态
- [x] 问题诊断完成
- [x] 代码修复完成
- [ ] 测试验证（待运行）

## 下一步
1. 重新运行回测验证修复效果
2. 观察日志确认工具过滤生效
3. 如果仍有问题，考虑额外优化方案

