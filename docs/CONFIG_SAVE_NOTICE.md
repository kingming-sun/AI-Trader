# 配置保存后生效说明

## ⚠️ 重要提示

**修改配置后，需要重启 `main.py` 才能生效！**

## 生效机制

### 1. 配置文件 (`configs/default_config.json`)
- **读取时机**：`main.py` 启动时读取一次
- **生效方式**：修改后需要**重启 `main.py`**
- **读取位置**：`main.py` 第 112 行 `config = load_config(config_path)`

### 2. Prompt 文件 (`prompts/agent_prompt.py`)
- **读取时机**：每次运行 `main.py` 时，Python 会重新导入模块
- **生效方式**：修改后需要**重启 `main.py`**
- **读取位置**：`agent/base_agent/base_agent.py` 第 243 行调用 `get_agent_system_prompt()`

## 正确的使用流程

### 步骤 1：修改配置
1. 在配置页面 (`http://localhost:8000/config.html`) 修改参数
2. 点击 "Save Configuration" 保存

### 步骤 2：确认保存成功
- 看到 "✅ Configuration saved successfully!" 提示
- 或者检查文件是否已更新：
  ```bash
  cat configs/default_config.json
  cat prompts/agent_prompt.py
  ```

### 步骤 3：重启程序
**必须重启 `main.py` 才能生效！**

```bash
# 如果 main.py 正在运行，先停止它（Ctrl+C）
# 然后重新启动
python main.py
```

## 验证配置是否生效

### 1. 检查日期范围
启动 `main.py` 时，会显示：
```
✅ Successfully loaded configuration file: configs/default_config.json
📅 Trading period: 2025-10-28 to 2025-10-30
```

### 2. 检查模型启用状态
启动时会显示：
```
✅ Enabled models: ['deepseek-chat-v3.1']
```

### 3. 检查 Prompt
在交易日志中可以看到使用的 prompt 内容。

## 常见问题

### Q: 修改配置后直接运行会生效吗？
**A:** 会！只要在运行 `main.py` **之前**修改配置并保存，新配置就会生效。

### Q: 如果 `main.py` 正在运行，修改配置会立即生效吗？
**A:** 不会！必须**重启 `main.py`** 才能读取新配置。

### Q: 如何在不重启的情况下更新配置？
**A:** 目前不支持热更新。需要重启程序。这是设计如此，因为：
- 配置在启动时读取一次，避免运行中配置变化导致不一致
- 确保整个回测过程使用相同的配置参数

### Q: 修改 Prompt 后，已经运行的交易会使用新 Prompt 吗？
**A:** 不会！只有重启 `main.py` 后，新的 Prompt 才会生效。

## 最佳实践

1. **修改配置前**：先停止正在运行的 `main.py`（如果有）
2. **修改配置**：在配置页面修改并保存
3. **验证配置**：检查文件内容是否正确
4. **启动程序**：运行 `python main.py`
5. **检查日志**：确认配置已正确加载

## 自动检查脚本

可以使用以下脚本检查配置是否已更新：

```bash
#!/bin/bash
# 检查配置文件的最后修改时间
echo "配置文件最后修改时间："
ls -lh configs/default_config.json
echo ""
echo "Prompt 文件最后修改时间："
ls -lh prompts/agent_prompt.py
```

如果文件时间戳显示刚刚修改过，说明保存成功。

