# Moomoo（富途牛牛）真实交易接入指南

## 📋 目录

1. [准备工作](#准备工作)
2. [安装和配置](#安装和配置)
3. [系统架构改造](#系统架构改造)
4. [代码修改步骤](#代码修改步骤)
5. [测试验证](#测试验证)
6. [风险提示](#风险提示)

---

## 🎯 准备工作

### 1.1 了解 Moomoo OpenAPI

Moomoo OpenAPI 是富途牛牛提供的官方 API 接口，支持程序化交易。

**核心组件：**
- **OpenD 网关程序**：负责转发 API 请求到富途后台，必须先在本地或服务器上运行
- **Futu API SDK**：富途提供的 Python SDK（pip 包名：`futu-api`）
- **API 密钥**：需要在 moomoo 平台获取

**官方文档：**
- OpenAPI 文档：https://openapi.moomoo.com/moomoo-api-doc/
- GitHub SDK：https://github.com/FutunnOpenAPI/py-futu-api

### 1.2 获取必要的认证信息

在使用真实交易之前，您需要准备以下信息：

1. **Moomoo 账户**（需要开户并激活交易权限）
2. **API 密钥**（可在 moomoo 官网申请）
3. **交易解锁密码**（用于启用程序化交易功能）
4. **OpenD 网关程序**（从官网下载）

---

## 🔧 安装和配置

### 2.1 安装 OpenD 网关程序

**步骤 1：下载 OpenD**
- 访问 https://openapi.moomoo.com/
- 下载对应操作系统的 OpenD 程序（Windows/Mac/Linux）

**步骤 2：启动 OpenD**
```bash
# Windows
OpenD.exe

# Mac/Linux
./OpenD
```

OpenD 启动后会监听默认端口 `127.0.0.1:11111`

### 2.2 安装 Python SDK

```bash
pip install futu-api
```

### 2.3 配置环境变量

在项目根目录的 `.env` 文件中添加以下配置：

```env
# Moomoo OpenAPI 配置
USE_MOOMOO=true                    # 是否使用真实交易（true/false）
MOOMOO_HOST=127.0.0.1              # OpenD 主机地址
MOOMOO_PORT=11111                  # OpenD 端口
MOOMOO_API_KEY=your_api_key        # API 密钥
MOOMOO_SECRET_KEY=your_secret      # 密钥
MOOMOO_UNLOCK_PASSWORD=your_password  # 交易解锁密码
MOOMOO_TRD_ENV=REAL                # 交易环境：REAL（实盘）或 SIMULATE（模拟盘）

# 可选：测试环境
MOOMOO_SIMULATE=false              # 是否使用模拟盘（true/false）
```

---

## 🏗️ 系统架构改造

### 3.1 当前模拟交易架构

```
┌─────────────────┐
│   AI Agent      │
│  (决策层)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Trade Tool │
│  (tool_trade.py)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 本地文件系统     │
│ (position.jsonl)│
└─────────────────┘
```

### 3.2 改造后的真实交易架构

```
┌─────────────────┐
│   AI Agent      │
│  (决策层)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Trade Tool │
│  (tool_trade.py)│  ← 需要修改
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────┐
│模拟模式  │ │  真实模式      │
│(默认)   │ │(新增)          │
└─────────┘ └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ Moomoo Client│
            │ (moomoo_client.py) │ ← 新增
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │  OpenD 网关   │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   Moomoo 平台 │
            │  (真实交易)   │
            └──────────────┘
```

---

## 📝 代码修改步骤

### 步骤 1：创建 Moomoo 客户端封装

**文件位置：** `agent_tools/moomoo_client.py`

**功能：**
- 封装 Moomoo API 调用
- 提供统一的接口（connect, disconnect, buy, sell, get_position 等）
- 处理错误和重连逻辑

**关键方法：**
```python
class MoomooClient:
    def connect()              # 连接到 OpenD
    def disconnect()            # 断开连接
    def buy(symbol, quantity)   # 买入股票
    def sell(symbol, quantity)  # 卖出股票
    def get_market_price(symbol)  # 获取实时价格
    def get_position(symbol)    # 获取持仓
    def get_available_cash()    # 获取可用现金
```

### 步骤 2：修改交易工具文件

**文件位置：** `agent_tools/tool_trade.py`

**修改策略：**

#### 2.1 在文件顶部添加模式判断逻辑

```python
# 检查是否使用真实交易
USE_REAL_TRADING = os.getenv("USE_MOOMOO", "false").lower() == "true"

if USE_REAL_TRADING:
    from agent_tools.moomoo_client import get_moomoo_client
```

#### 2.2 修改 `buy()` 函数

**原逻辑：**
1. 从本地文件读取持仓
2. 从本地数据获取价格
3. 更新本地文件

**新逻辑：**
```python
def buy(symbol: str, amount: int) -> Dict[str, Any]:
    if USE_REAL_TRADING:
        # 真实交易模式
        moomoo_client = get_moomoo_client()
        if not moomoo_client:
            return {"error": "Moomoo client not initialized"}
        
        # 调用真实交易API
        result = moomoo_client.buy(symbol, amount)
        
        # 同时记录到本地文件（用于追踪）
        if result["success"]:
            # 更新本地记录
            update_local_position(symbol, amount, "buy")
        
        return result
    else:
        # 原有的模拟交易逻辑
        # ... 保持不变
```

#### 2.3 修改 `sell()` 函数

与 `buy()` 类似，添加真实交易的分支逻辑。

### 步骤 3：修改价格获取逻辑

**文件位置：** `agent_tools/tool_get_price_local.py`

**修改内容：**
```python
def get_price_local(symbol: str, date: str) -> Dict[str, Any]:
    if USE_REAL_TRADING and date == get_today_date():
        # 真实交易模式且是今天：从 Moomoo 获取实时价格
        moomoo_client = get_moomoo_client()
        if moomoo_client:
            price = moomoo_client.get_market_price(symbol)
            if price:
                return {"symbol": symbol, "date": date, "price": price}
    
    # 历史价格或模拟模式：从本地文件读取
    # ... 原有逻辑
```

### 步骤 4：修改 Agent 初始化逻辑

**文件位置：** `agent/base_agent/base_agent.py`

在 `initialize()` 方法中添加：

```python
async def initialize(self):
    # ... 原有初始化逻辑
    
    # 如果是真实交易模式，初始化 Moomoo 客户端
    if os.getenv("USE_MOOMOO", "false").lower() == "true":
        from agent_tools.moomoo_client import init_moomoo_client
        if init_moomoo_client():
            print("✅ Moomoo client initialized")
        else:
            print("❌ Failed to initialize Moomoo client")
            # 可以选择退出或回退到模拟模式
```

### 步骤 5：修改主程序

**文件位置：** `main.py`

在 `main()` 函数中添加清理逻辑：

```python
async def main(config_path=None):
    try:
        # ... 原有逻辑
        
    finally:
        # 清理资源
        if os.getenv("USE_MOOMOO", "false").lower() == "true":
            from agent_tools.moomoo_client import close_moomoo_client
            close_moomoo_client()
            print("✅ Moomoo connection closed")
```

---

## 🧪 测试验证

### 测试策略

**原则：先模拟，再真实**

#### 阶段 1：本地测试（模拟模式）
1. 保持 `USE_MOOMOO=false`
2. 验证交易逻辑不变
3. 确保所有功能正常

#### 阶段 2：连接测试
1. 启动 OpenD 程序
2. 设置 `USE_MOOMOO=true`
3. 运行连接测试：只查询价格，不下单
```python
# 测试脚本
python -c "from agent_tools.moomoo_client import *; client = MoomooClient(); client.connect(); print(client.get_market_price('AAPL'))"
```

#### 阶段 3：模拟交易测试
1. 使用 moomoo 模拟盘功能
2. 设置 `MOOMOO_TRD_ENV=SIMULATE`
3. 进行小额测试交易
4. 验证订单执行和持仓更新

#### 阶段 4：真实交易测试（小金额）
1. 设置 `MOOMOO_TRD_ENV=REAL`
2. 使用最小交易金额
3. 单次交易测试
4. 验证资金和持仓变化

#### 阶段 5：完整回测验证
1. 短期历史回测（如 3 天）
2. 对比模拟和真实交易的差异
3. 检查订单执行延迟、滑点等

---

## 🔍 关键修改点总结

### 需要修改的文件列表

```
AI-Trader/
├── agent_tools/
│   ├── moomoo_client.py          ← 新建：Moomoo API 封装
│   ├── tool_trade.py             ← 修改：添加真实交易分支
│   └── tool_get_price_local.py   ← 修改：添加实时价格获取
├── agent/base_agent/
│   └── base_agent.py             ← 修改：初始化 Moomoo 客户端
├── main.py                       ← 修改：添加清理逻辑
└── .env                          ← 修改：添加 Moomoo 配置
```

### 代码修改的核心逻辑

```python
# 伪代码示例
def execute_trade(action, symbol, amount):
    if is_real_trading_mode():
        # 真实交易
        result = moomoo_client.trade(action, symbol, amount)
        
        # 验证交易结果
        if result.success:
            # 记录到本地文件（用于追踪和回测对比）
            save_local_record(result)
        
        return result
    else:
        # 模拟交易
        return simulated_trade(action, symbol, amount)
```

---

## ⚠️ 风险提示

### 1. 法律和监管风险
- **合规性**：确保在您所在地区使用程序化交易合法
- **账户安全**：妥善保管 API 密钥和交易密码
- **监管要求**：遵守当地金融监管规定

### 2. 技术风险
- **网络延迟**：真实交易可能存在延迟，影响策略执行
- **API 限制**：注意 moomoo API 的调用频率限制
- **订单执行**：实际成交价格可能与预期不同（滑点）

### 3. 资金风险
- **风险控制**：建议设置严格的止损和仓位管理
- **测试先行**：先在模拟环境充分测试
- **小额测试**：真实交易先用小金额验证

### 4. 建议的安全措施

```python
# 添加风险控制逻辑
def execute_trade_with_risk_control(action, symbol, amount):
    # 1. 检查单笔交易限额
    if amount > MAX_SINGLE_TRADE:
        return {"error": "Amount exceeds limit"}
    
    # 2. 检查日内总交易次数
    if daily_trade_count >= MAX_DAILY_TRADES:
        return {"error": "Daily trade limit reached"}
    
    # 3. 检查最大持仓
    if get_total_position_value() > MAX_POSITION_VALUE:
        return {"error": "Position limit exceeded"}
    
    # 4. 执行交易
    return execute_trade(action, symbol, amount)
```

---

## 📚 参考资源

### 官方文档
- Moomoo OpenAPI: https://openapi.moomoo.com/moomoo-api-doc/
- Futu SDK GitHub: https://github.com/FutunnOpenAPI/py-futu-api

### 相关概念
- **OpenD 网关**：Moomoo API 的中转服务
- **TrdEnv**：交易环境（REAL=实盘, SIMULATE=模拟盘）
- **TrdSide**：交易方向（BUY=买入, SELL=卖出）
- **OrderType**：订单类型（NORMAL=普通单, MARKET=市价单）

---

## 📞 获取帮助

如果遇到问题：

1. **技术问题**：查看 Moomoo OpenAPI 官方文档
2. **账户问题**：联系 moomoo 客服
3. **代码问题**：提交 GitHub Issue

---

**最后提醒：**
- 🔒 真实交易存在资金损失风险
- 🧪 务必在模拟环境充分测试
- 📊 建议从最小金额开始
- ⚖️ 遵守当地法律法规
- 🛡️ 做好风险控制和资金管理

