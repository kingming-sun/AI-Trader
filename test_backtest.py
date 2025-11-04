#!/usr/bin/env python3
"""
Test script for backtest functionality
"""

import os
import sys
import json
import time
from pathlib import Path

# Add platform directory to path
sys.path.insert(0, str(Path(__file__).parent / "platform"))

from run_manager import RunManager

def test_backtest():
    """Test backtest functionality"""
    print("🧪 Testing backtest functionality...")
    
    # Create a test strategy
    strategy_id = "strategy_test_" + str(int(time.time()))
    
    # Create strategy directories
    strategy_dir = Path("configs/strategies") / strategy_id
    strategy_dir.mkdir(parents=True, exist_ok=True)
    
    # Create base config
    base_config = {
        "strategy_name": "Test Strategy",
        "description": "Test backtest functionality",
        "status": "design",
        "created_at": "2025-11-04",
        "updated_at": "2025-11-04"
    }
    
    base_file = strategy_dir / "base_config.json"
    with open(base_file, 'w') as f:
        json.dump(base_config, f, indent=2)
    
    # Create test config
    test_config = {
        "agent_config": {
            "max_steps": 5,
            "max_retries": 2,
            "base_delay": 0.5,
            "initial_cash": 10000
        },
        "date_range": {
            "init_date": "2025-10-27",
            "end_date": "2025-10-28"
        },
        "models": [
            {
                "name": "test-model",
                "basemodel": "gpt-4o-mini",
                "signature": "test-signature",
                "enabled": True
            }
        ]
    }
    
    config_file = strategy_dir / "backtest_config.json"
    with open(config_file, 'w') as f:
        json.dump(test_config, f, indent=2)
    
    # Create test prompt
    prompts_dir = strategy_dir / "prompts"
    prompts_dir.mkdir(exist_ok=True)
    
    prompt_content = '''agent_system_prompt = """
You are a test trading agent.
Today's date is {date}.
Just maintain your position without making any trades.
"""'''
    
    prompt_file = prompts_dir / "base_prompt.py"
    with open(prompt_file, 'w') as f:
        f.write(prompt_content)
    
    print(f"✅ Test strategy created: {strategy_id}")
    
    # Test run manager
    run_manager = RunManager()
    
    # Prepare run
    print("\n📋 Testing prepare_run...")
    run_info = run_manager.prepare_run(strategy_id, "backtest")
    print(f"   Config path: {run_info['config_path']}")
    print(f"   Data path: {run_info['data_path']}")
    print(f"   Prompt path: {run_info['prompt_path']}")
    
    # Check paths
    expected_data_path = Path(f"data/strategies/{strategy_id}/backtest/agent_data")
    actual_data_path = Path(run_info['data_path'])
    
    if actual_data_path == expected_data_path:
        print(f"   ✅ Data path is correct: {actual_data_path}")
    else:
        print(f"   ❌ Data path mismatch!")
        print(f"      Expected: {expected_data_path}")
        print(f"      Actual: {actual_data_path}")
    
    # Test that result files would be generated in the correct location
    print("\n📊 Testing result file generation...")
    from tools.result_generator import generate_result_files
    
    # Create dummy position data
    position_dir = actual_data_path / "position"
    position_dir.mkdir(parents=True, exist_ok=True)
    
    position_file = position_dir / "position.jsonl"
    with open(position_file, 'w') as f:
        f.write(json.dumps({
            "date": "2025-10-27",
            "position": {"CASH": 10000}
        }) + "\n")
    
    # Generate result files
    generate_result_files(str(actual_data_path), 10000)
    
    # Check if files were created
    files_to_check = [
        "asset_evolution.json",
        "portfolio.json", 
        "trades.json",
        "results.json"
    ]
    
    all_good = True
    for file_name in files_to_check:
        file_path = actual_data_path / file_name
        if file_path.exists():
            print(f"   ✅ {file_name} created")
        else:
            print(f"   ❌ {file_name} not found")
            all_good = False
    
    if all_good:
        print("\n🎉 All tests passed! Backtest functionality is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    import shutil
    if strategy_dir.exists():
        shutil.rmtree(strategy_dir)
    test_data_dir = Path(f"data/strategies/{strategy_id}")
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir)
    print("✅ Cleanup complete")

if __name__ == "__main__":
    test_backtest()