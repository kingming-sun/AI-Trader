#!/usr/bin/env python3
"""
Test script to verify data generation for strategy
"""

import json
from pathlib import Path

# Create test data structure
data_dir = Path("data/strategies/strategy_20251104_163045/backtest")
data_dir.mkdir(parents=True, exist_ok=True)

# Create test asset evolution data
asset_evolution = []
initial_value = 10000
current_value = initial_value

for day in range(1, 31):  # October 1-30
    # Simulate random walk with slight upward trend
    import random
    change = (random.random() - 0.45) * 0.02  # Slight positive bias
    current_value = current_value * (1 + change)
    
    asset_evolution.append({
        "date": f"2025-10-{day:02d}",
        "total_value": round(current_value, 2),
        "cash": round(current_value * 0.3, 2),
        "stock_value": round(current_value * 0.7, 2)
    })

# Create test results file
results = {
    "asset_evolution": asset_evolution,
    "metrics": {
        "initial_value": 10000,
        "final_value": current_value,
        "total_return": ((current_value - 10000) / 10000) * 100,
        "max_drawdown": -5.2,
        "sharpe_ratio": 1.85,
        "trading_days": 30
    },
    "portfolio": {
        "holdings": [
            {
                "symbol": "AAPL",
                "shares": 50,
                "cost": 150,
                "current": 175,
                "pnl": 1250,
                "pnlPercent": 16.67
            },
            {
                "symbol": "GOOGL",
                "shares": 20,
                "cost": 2800,
                "current": 2950,
                "pnl": 3000,
                "pnlPercent": 5.36
            }
        ]
    }
}

# Save results
results_file = data_dir / "results.json"
with open(results_file, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)

print(f"✅ Test data created at: {results_file}")

# Create test log data
log_dir = data_dir / "log" / "2025-10-27"
log_dir.mkdir(parents=True, exist_ok=True)

# Create log entries
logs = [
    {
        "timestamp": "2025-10-27T09:30:00",
        "signature": "strategy_20251104_163045",
        "new_messages": [
            {
                "role": "user",
                "content": "开始今日交易分析"
            },
            {
                "role": "assistant",
                "content": "分析市场数据...\n检测到AAPL价格突破关键阻力位\n建议买入50股"
            }
        ]
    },
    {
        "timestamp": "2025-10-27T10:00:00",
        "signature": "strategy_20251104_163045",
        "new_messages": [
            {
                "role": "user",
                "content": "执行交易"
            },
            {
                "role": "assistant",
                "content": "已成功买入AAPL 50股 @ $175"
            }
        ]
    }
]

log_file = log_dir / "log.jsonl"
with open(log_file, "w", encoding="utf-8") as f:
    for log in logs:
        f.write(json.dumps(log, ensure_ascii=False) + "\n")

print(f"✅ Test logs created at: {log_file}")
print("✅ All test data generated successfully!")