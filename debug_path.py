#!/usr/bin/env python3
"""
Debug script to check data path
"""

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent / "platform"))

from strategy_manager import StrategyManager

strategy_manager = StrategyManager()
strategy_id = "strategy_20251104_163045"
mode = "backtest"

data_path = strategy_manager.get_strategy_data_path(strategy_id, mode)
print(f"Data path: {data_path}")
print(f"Data path exists: {data_path.exists()}")

agent_data_dir = data_path / "agent_data"
print(f"Agent data dir: {agent_data_dir}")
print(f"Agent data dir exists: {agent_data_dir.exists()}")

if agent_data_dir.exists():
    print(f"Contents: {list(agent_data_dir.iterdir())}")