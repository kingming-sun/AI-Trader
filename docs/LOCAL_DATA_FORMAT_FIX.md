# 本地数据重复下载问题修复

## 问题描述
回测时发现即使本地 `merged.jsonl` 中已有 2025-10-27 的价格数据，系统仍然从 Alpha Vantage API 重新下载所有数据。

## 根本原因

### 数据格式不匹配

1. **Alpha Vantage API 返回格式**（标准格式）：
```json
"2025-10-27": {
    "1. open": "189.99",
    "2. high": "192.0",
    "3. low": "188.4318",
    "4. close": "191.49",
    "5. volume": "153452704"
}
```

2. **本地存储格式**（merged.jsonl）：
```json
"2025-10-27": {
    "1. buy price": "189.99",
    "2. high": "192.0",
    "3. low": "188.4318",
    "4. sell price": "191.49",
    "5. volume": "153452704"
}
```

3. **原读取代码**（`_get_price_from_local` 函数，第85-91行）：
```python
# ❌ 只查找标准格式的键名
"open": float(day_data.get("1. open", 0)),      # 找不到！
"close": float(day_data.get("4. close", 0)),    # 找不到！
```

### 问题链
```
读取本地数据 → 查找 "1. open" → 找不到 → 返回 None 
→ 认为本地无数据 → 调用API下载 → 重新保存（使用 "1. buy price" 格式）
→ 下次读取仍然失败 → 无限循环！
```

## 修复方案

### 修改文件：`tools/price_tools.py`

**第85-94行** - 让 `_get_price_from_local` 函数支持两种格式：

```python
# 修复后：同时支持两种格式
# Support both formats: "1. open"/"4. close" and "1. buy price"/"4. sell price"
open_price = day_data.get("1. open") or day_data.get("1. buy price", 0)
close_price = day_data.get("4. close") or day_data.get("4. sell price", 0)
return {
    "open": float(open_price),
    "high": float(day_data.get("2. high", 0)),
    "low": float(day_data.get("3. low", 0)),
    "close": float(close_price),
    "volume": int(day_data.get("5. volume", 0))
}
```

### 修复原理

使用 `or` 运算符实现向后兼容：
1. 首先尝试标准格式 `"1. open"` / `"4. close"`
2. 如果找不到，则使用本地格式 `"1. buy price"` / `"4. sell price"`
3. 两种格式都能正确读取

## 验证效果

修复后的行为：
```
读取本地数据 → 查找 "1. open" → 未找到 
→ 查找 "1. buy price" → ✅ 找到！
→ 返回价格数据 → 无需调用API → 节省API调用次数
```

### 预期日志输出

修复前：
```
📊 Fetching yesterday's prices for 101 stocks...
📊 Fetching yesterday's prices for 101 stocks (date: 2025-10-24)...
💾 Saved price data for NVDA on 2025-10-24 to local file    ← 重复保存
💾 Saved price data for MSFT on 2025-10-24 to local file    ← 重复保存
...
```

修复后：
```
📊 Fetching yesterday's prices for 101 stocks...
📊 Fetching yesterday's prices for 101 stocks (date: 2025-10-24)...
✅ Yesterday's price fetch complete: 101 from local, 0 from API, 0 missing    ← 全部从本地读取！
✅ Successfully fetched yesterday's prices
```

## 相关代码位置

### 已修复
- ✅ `_get_price_from_local` (第55-98行)：读取本地数据

### 格式正确（无需修改）
- `_save_price_to_local` (第99-225行)：保存为本地格式 `"1. buy price"` / `"4. sell price"`
- `_get_price_from_api` (第227-309行)：从API读取标准格式 `"1. open"` / `"4. close"`

## 效益

1. **节省API调用**：
   - 回测10天，101只股票
   - 原来：每天 101 * 2 = 202 次API调用
   - 修复后：首次运行后，后续回测 0 次API调用
   - 总共节省：约 2,020 次API调用

2. **加快回测速度**：
   - 原来：每天等待约 1.6 分钟（101股票 × 0.45秒/股 × 2次）
   - 修复后：本地读取 < 1 秒

3. **避免API限额**：
   - Alpha Vantage 免费版：25次请求/天
   - 修复后可以无限次回测而不受API限制

## 状态
- [x] 问题诊断完成
- [x] 代码修复完成
- [ ] 测试验证（待运行）

## 测试步骤

1. 确认本地数据存在：
```bash
grep "2025-10-27" /Users/qiming.sun/AI-Trader/data/merged.jsonl | head -1
```

2. 重新运行回测，应该看到从本地读取数据：
```bash
cd /Users/qiming.sun/AI-Trader
python main.py
```

3. 检查日志，应该显示：
```
✅ Yesterday's price fetch complete: 101 from local, 0 from API, 0 missing
```

## 技术说明

### Python `or` 运算符的短路特性
```python
open_price = day_data.get("1. open") or day_data.get("1. buy price", 0)
```

工作原理：
1. 先执行 `day_data.get("1. open")`
2. 如果返回值为 `None` 或空字符串（falsy），则执行右侧表达式
3. 返回第一个 truthy 值

这样既支持新格式，也支持旧格式，保证了向后兼容性。

