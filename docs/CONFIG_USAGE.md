# 配置管理页面使用说明

## 功能说明

配置管理页面 (`config.html`) 提供了一个可视化的界面来修改系统配置，包括：

1. **交易日期范围** - 设置回测的开始和结束日期
2. **Agent 配置参数** - 调整 AI 代理的行为参数
3. **模型启用状态** - 启用或禁用不同的 AI 模型
4. **Prompt 配置** - 自定义 AI 代理的系统提示词

## 使用方法

### 1. 访问配置页面

1. 启动前端服务器：
   ```bash
   cd docs
   python3 -m http.server 8000
   ```

2. 在浏览器中访问：
   ```
   http://localhost:8000/config.html
   ```

### 2. 加载当前配置

- 点击 **"Load Current Config"** 按钮加载当前的配置文件
- 系统会自动读取 `configs/default_config.json` 和 `prompts/agent_prompt.py`

### 3. 修改配置

#### 交易日期范围
- **Start Date**: 设置回测开始日期（格式：YYYY-MM-DD）
- **End Date**: 设置回测结束日期（格式：YYYY-MM-DD）

#### Agent 配置参数
- **Max Steps**: AI 推理的最大步数（1-100，建议 10-30）
- **Max Retries**: 失败重试次数（1-10）
- **Base Delay**: 重试延迟时间（秒，0.1-10）
- **Initial Cash**: 初始资金（美元，至少 $100）

#### 模型启用状态
- 切换每个模型旁边的开关来启用/禁用模型
- 可以修改 Base Model 和 Signature 字段

#### Prompt 配置
- 在文本框中编辑系统提示词
- 可以使用以下占位符：
  - `{date}` - 当前交易日期
  - `{positions}` - 昨日持仓
  - `{yesterday_close_price}` - 昨日收盘价
  - `{today_buy_price}` - 今日买入价
  - `{STOP_SIGNAL}` - 停止信号标记

### 4. 保存配置

有两种方式保存配置：

#### 方式 1：下载配置文件（推荐）
1. 点击 **"Save Configuration"** 或 **"Download Config File"** 按钮
2. 系统会下载两个文件：
   - `default_config.json` - 配置文件
   - `agent_prompt.py` - Prompt 文件
3. 手动替换项目中的文件：
   ```bash
   # 替换配置文件
   mv ~/Downloads/default_config.json configs/default_config.json
   
   # 替换 Prompt 文件
   mv ~/Downloads/agent_prompt.py prompts/agent_prompt.py
   ```

#### 方式 2：使用 API（需要后端支持）
如果配置了后端 API，可以直接通过界面保存（需要额外开发）。

### 5. 重置配置

点击 **"Reset to Default"** 按钮可以恢复到默认配置。

## 注意事项

1. **文件路径**：确保前端服务器从 `docs` 目录启动，这样才能正确加载配置文件
2. **验证**：保存前系统会自动验证配置的有效性
3. **备份**：修改配置前建议备份原始文件
4. **生效**：修改配置后需要重启 `main.py` 才能生效

## 故障排除

### 无法加载配置文件
- 检查 HTTP 服务器是否从 `docs` 目录启动
- 检查 `configs/default_config.json` 文件是否存在
- 查看浏览器控制台的错误信息

### Prompt 加载失败
- 检查 `prompts/agent_prompt.py` 文件是否存在
- 确保文件格式正确（包含 `agent_system_prompt = """..."""`）

### 下载的文件无法使用
- 确保下载的文件格式正确（JSON 和 Python）
- 检查文件路径是否正确
- 验证文件权限

## 示例配置

### 快速调试配置
```json
{
  "date_range": {
    "init_date": "2025-10-28",
    "end_date": "2025-10-30"
  },
  "agent_config": {
    "max_steps": 10,
    "max_retries": 3,
    "base_delay": 1.0,
    "initial_cash": 10000
  }
}
```

### 保守策略 Prompt
```
You are a conservative stock trading assistant. 
Prioritize capital preservation over high returns.
Only make trades when you have high confidence (>80%).
```

### 激进策略 Prompt
```
You are an aggressive stock trading assistant.
Focus on maximizing returns through active trading.
Take calculated risks when opportunities arise.
```

