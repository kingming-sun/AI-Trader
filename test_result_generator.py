#!/usr/bin/env python3
"""Test result generator with sample data"""

import json
from pathlib import Path
from tools.result_generator import generate_result_files

# Create test position data with multiple days
test_positions = [
    {
        "date": "2025-10-20",
        "id": 0,
        "positions": {"CASH": 10000, "AAPL": 0, "GOOGL": 0}
    },
    {
        "date": "2025-10-21", 
        "id": 1,
        "positions": {"CASH": 7000, "AAPL": 10, "GOOGL": 0}  # Bought 10 AAPL
    },
    {
        "date": "2025-10-22",
        "id": 2, 
        "positions": {"CASH": 4500, "AAPL": 10, "GOOGL": 5}  # Bought 5 GOOGL
    },
    {
        "date": "2025-10-23",
        "id": 3,
        "positions": {"CASH": 6500, "AAPL": 5, "GOOGL": 5}  # Sold 5 AAPL
    },
    {
        "date": "2025-10-24",
        "id": 4,
        "positions": {"CASH": 8000, "AAPL": 5, "GOOGL": 2}  # Sold 3 GOOGL
    }
]

# Create test directory
test_dir = Path("data/test_strategy/backtest/agent_data")
test_dir.mkdir(parents=True, exist_ok=True)

# Write test position data
position_dir = test_dir / "position"
position_dir.mkdir(exist_ok=True)
position_file = position_dir / "position.jsonl"

with open(position_file, 'w') as f:
    for pos in test_positions:
        f.write(json.dumps(pos) + "\n")

print(f"📝 Created test data with {len(test_positions)} position records")

# Generate result files
print("\n🔧 Generating result files...")
generate_result_files(str(test_dir), 10000)

# Check generated files
print("\n📊 Generated files:")
for file in ["asset_evolution.json", "portfolio.json", "trades.json", "results.json"]:
    file_path = test_dir / file
    if file_path.exists():
        with open(file_path, 'r') as f:
            data = json.load(f)
            if file == "asset_evolution.json":
                print(f"  ✅ {file}: {len(data)} records")
                if data:
                    print(f"     Initial value: ${data[0]['total_value']}")
                    print(f"     Final value: ${data[-1]['total_value']}")
                    print(f"     Return: {data[-1]['return_rate']:.2f}%")
            elif file == "trades.json":
                print(f"  ✅ {file}: {len(data)} trades")
                for trade in data[:3]:  # Show first 3 trades
                    print(f"     {trade['date']}: {trade['action']} {trade['shares']} {trade['symbol']}")
            elif file == "portfolio.json":
                print(f"  ✅ {file}: {len(data['holdings'])} holdings, cash=${data['cash']}")
            elif file == "results.json":
                summary = data.get('summary', {})
                print(f"  ✅ {file}: Return={summary.get('total_return', 0):.2f}%, Trades={summary.get('total_trades', 0)}")
    else:
        print(f"  ❌ {file}: Not found")

print("\n✅ Test complete!")