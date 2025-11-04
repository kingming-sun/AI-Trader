# 重启后为什么日期还没变？

## 问题原因

前端显示的 **"TRADING PERIOD"** 不是从配置文件读取的，而是从**实际的历史交易数据文件**中计算出来的。

### 数据来源

前端代码（`asset-chart.js`）会：
1. 读取 `data/agent_data/{agent}/position/position.jsonl` 文件
2. 找到所有交易记录中的最早日期和最新日期
3. 显示为 "TRADING PERIOD"

### 为什么重启后还没变？

1. **配置文件已更新**：`configs/default_config.json` 中的日期范围已改为新值
2. **main.py 已重启**：程序使用新的日期范围开始运行
3. **但新数据还没生成**：需要等待 `main.py` 运行完成，生成新的交易数据
4. **前端显示旧数据**：前端还在读取旧的历史数据文件

## 正确流程

### 步骤 1：修改配置并保存
- 在配置页面修改日期范围
- 点击 "Save Configuration"

### 步骤 2：重启 main.py
- 点击 "🔄 Restart main.py"
- 等待程序启动

### 步骤 3：等待程序运行完成
- **重要**：需要等待 `main.py` 运行完成，生成新的交易数据
- 新日期范围的数据会写入 `data/agent_data/{agent}/position/position.jsonl`
- 只有生成了新数据，前端才能显示新的日期范围

### 步骤 4：刷新前端页面
- 等待 `main.py` 运行完成后
- 刷新浏览器页面（F5 或 Cmd+R）
- 前端会重新读取数据文件，显示新的日期范围

## 验证方法

### 1. 检查配置文件
```bash
cat configs/default_config.json | grep -A 2 "date_range"
```

### 2. 检查 main.py 是否在运行
```bash
ps aux | grep main.py
```

### 3. 检查最新数据日期
```bash
tail -1 data/agent_data/deepseek-chat-v3.1/position/position.jsonl | python3 -c "import sys, json; d=json.loads(sys.stdin.read()); print(d.get('date', 'N/A'))"
```

### 4. 检查数据文件修改时间
```bash
ls -lh data/agent_data/deepseek-chat-v3.1/position/position.jsonl
```

如果文件修改时间是最新的，说明新数据已生成。

## 总结

- ✅ **重启功能正常工作**：main.py 已使用新配置启动
- ⏳ **需要等待**：等待 main.py 运行完成，生成新日期的交易数据
- 🔄 **刷新前端**：生成新数据后，刷新前端页面才能看到新的日期范围

**前端显示的是实际交易数据的日期范围，不是配置文件的日期范围！**

