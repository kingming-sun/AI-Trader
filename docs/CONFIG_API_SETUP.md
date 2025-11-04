# 配置 API 使用说明

## 概述

配置管理界面现在支持直接保存配置，无需手动下载和替换文件。这通过一个 Flask API 服务器实现。

## 快速开始

### 1. 安装依赖

```bash
pip install flask flask-cors
```

或者使用 requirements.txt：

```bash
pip install -r requirements.txt
```

### 2. 启动配置 API 服务器

在项目根目录运行：

```bash
python3 config_api.py
```

或者使用脚本：

```bash
./start_config_api.sh
```

API 服务器将在端口 **8004** 启动。

### 3. 启动前端服务器

在另一个终端，进入 `docs` 目录：

```bash
cd docs
python3 -m http.server 8000
```

### 4. 访问配置页面

打开浏览器访问：

```
http://localhost:8000/config.html
```

## API 端点

### 获取配置
```
GET http://localhost:8004/api/config
```

### 保存配置
```
POST http://localhost:8004/api/config
Content-Type: application/json

{
  "date_range": {...},
  "models": [...],
  "agent_config": {...}
}
```

### 获取 Prompt
```
GET http://localhost:8004/api/prompt
```

### 保存 Prompt
```
POST http://localhost:8004/api/prompt
Content-Type: application/json

{
  "prompt": "..."
}
```

### 健康检查
```
GET http://localhost:8004/health
```

## 功能特点

1. **直接保存**：配置修改后点击"Save Configuration"即可保存到文件
2. **自动备份**：保存前会自动创建 `.backup` 备份文件
3. **实时验证**：保存前会验证配置的有效性
4. **错误处理**：清晰的错误提示信息

## 使用流程

1. 打开配置页面 `http://localhost:8000/config.html`
2. 点击 "Load Current Config" 加载当前配置
3. 修改各项参数（日期范围、Agent 配置、模型启用状态、Prompt）
4. 点击 "Save Configuration" 保存
5. 看到成功提示后，配置已保存到文件

## 注意事项

1. **API 服务器必须运行**：确保 `config_api.py` 正在运行，否则前端无法加载或保存配置
2. **端口冲突**：默认使用 8004 端口，如果被占用可以设置环境变量：
   ```bash
   export CONFIG_API_PORT=8005
   python3 config_api.py
   ```
3. **文件权限**：确保 Python 进程有权限读写 `configs/default_config.json` 和 `prompts/agent_prompt.py`
4. **备份文件**：保存时会自动创建 `.backup` 文件，可以用于恢复

## 故障排除

### 无法连接到 API
- 检查 API 服务器是否正在运行
- 检查端口 8004 是否被占用
- 查看浏览器控制台的错误信息

### 保存失败
- 检查文件权限
- 检查文件路径是否正确
- 查看 API 服务器的错误日志

### CORS 错误
- 确保安装了 `flask-cors`
- 检查 API 服务器的 CORS 配置

## 开发模式

如果需要在开发模式下运行（自动重载），可以修改 `config_api.py` 最后一行：

```python
app.run(host='0.0.0.0', port=port, debug=True)
```

注意：生产环境请使用 `debug=False`。

