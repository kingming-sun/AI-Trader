# 策略卡片界面修改说明

## 修改概述

本文档说明需要对策略管理界面中的策略卡片进行的修改。

## 修改目标

1. **移除策略卡片中的操作按钮**：删除"回测"、"模拟"、"实盘"三个按钮
2. **确保删除功能可用性**：无论策略处于何种状态（包括"回测中"），都应该可以删除策略

## 当前实现

### 文件位置

- **HTML模板**：`docs/strategies.html`
- **JavaScript逻辑**：`docs/assets/js/strategy-manager.js`

### 当前按钮布局

在 `strategy-manager.js` 的 `loadStrategies()` 函数中（第140-145行），策略卡片当前包含以下按钮：

```140:145:docs/assets/js/strategy-manager.js
            <div class="strategy-actions">
                <button class="btn-small btn-edit" onclick="editStrategy('${strategy.strategy_id}')">查看详情</button>
                <button class="btn-small btn-run" onclick="runStrategy('${strategy.strategy_id}', 'backtest')">回测</button>
                <button class="btn-small btn-run" onclick="runStrategy('${strategy.strategy_id}', 'simulate')">模拟</button>
                <button class="btn-small btn-run" style="background: var(--danger);" onclick="runStrategy('${strategy.strategy_id}', 'real')">实盘</button>
                <button class="btn-small btn-delete" style="background: var(--danger); margin-left: auto;" onclick="deleteStrategy('${strategy.strategy_id}', '${strategy.strategy_name}')">删除</button>
            </div>
```

## 需要进行的修改

### 修改1：移除"回测"、"模拟"、"实盘"按钮

**位置**：`docs/assets/js/strategy-manager.js` 第142-144行

**操作**：删除以下三行代码：
- 第142行：`<button class="btn-small btn-run" onclick="runStrategy('${strategy.strategy_id}', 'backtest')">回测</button>`
- 第143行：`<button class="btn-small btn-run" onclick="runStrategy('${strategy.strategy_id}', 'simulate')">模拟</button>`
- 第144行：`<button class="btn-small btn-run" style="background: var(--danger);" onclick="runStrategy('${strategy.strategy_id}', 'real')">实盘</button>`

**修改后的代码**：
```javascript
<div class="strategy-actions">
    <button class="btn-small btn-edit" onclick="editStrategy('${strategy.strategy_id}')">查看详情</button>
    <button class="btn-small btn-delete" style="background: var(--danger); margin-left: auto;" onclick="deleteStrategy('${strategy.strategy_id}', '${strategy.strategy_name}')">删除</button>
</div>
```

### 修改2：确认删除功能无状态限制

**位置**：`docs/assets/js/strategy-manager.js` 第78-106行

**当前实现检查**：
- `deleteStrategy()` 方法目前没有对策略状态进行检查
- 删除操作会显示确认对话框，但不限制任何状态的策略删除
- **结论**：当前实现已经满足要求，无需修改

**验证点**：
- ✅ 删除功能不检查策略状态
- ✅ 所有状态的策略都可以被删除（包括"回测中"、"模拟中"、"实盘中"等）
- ✅ 删除前会显示确认对话框，提醒用户操作不可恢复

## 修改后的界面效果

### 策略卡片按钮布局

修改后，每个策略卡片将只包含两个按钮：

1. **查看详情**（蓝色/灰色按钮）
   - 功能：跳转到策略详情页面
   - 位置：左侧

2. **删除**（红色按钮）
   - 功能：删除策略（需要确认）
   - 位置：右侧（使用 `margin-left: auto;` 自动靠右）

### 功能说明

- **查看详情**：点击后跳转到 `strategy-detail.html`，可以在详情页面中进行策略配置、查看资产演变、运行回测/模拟/实盘等操作
- **删除**：点击后弹出确认对话框，确认后删除策略及其所有配置和数据

## 注意事项

1. **运行策略的方式**：
   - 移除卡片上的快速运行按钮后，用户需要通过"查看详情"进入策略详情页面
   - 在策略详情页面的"资产演变"标签页中，可以选择模式（回测/模拟/实盘）并运行策略

2. **删除功能**：
   - 删除操作会删除策略的所有配置和数据，且不可恢复
   - 无论策略处于何种运行状态，都可以执行删除操作
   - 建议在删除前，系统应该先停止正在运行的策略进程（如果存在）

3. **用户体验**：
   - 移除快速运行按钮后，操作流程变为：查看详情 → 选择模式 → 运行
   - 这样可以避免在列表页面误操作启动策略
   - 所有策略运行操作集中在详情页面，界面更加清晰

## 相关函数

### 需要修改的函数

- `loadStrategies()` - 策略列表渲染函数

### 不需要修改的函数

- `deleteStrategy()` - 删除策略函数（已满足要求）
- `runStrategy()` - 运行策略函数（仍可在详情页面使用）
- `editStrategy()` - 查看详情函数（保持不变）

## 测试建议

修改完成后，建议进行以下测试：

1. ✅ 验证策略卡片只显示"查看详情"和"删除"两个按钮
2. ✅ 验证"查看详情"按钮功能正常
3. ✅ 验证"删除"按钮在策略处于"回测中"状态时可以正常删除
4. ✅ 验证"删除"按钮在策略处于"模拟中"状态时可以正常删除
5. ✅ 验证"删除"按钮在策略处于"实盘中"状态时可以正常删除
6. ✅ 验证删除确认对话框正常显示
7. ✅ 验证删除后策略列表正确更新

