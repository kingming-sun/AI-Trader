#!/usr/bin/env python3
"""
Strategy Management Module
Handles strategy creation, configuration, and mode switching
"""

import os
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Literal

TradingMode = Literal["backtest", "simulate", "real"]

class StrategyManager:
    """Strategy configuration and management"""
    
    def __init__(self, project_root: Optional[str] = None):
        if project_root is None:
            project_root = Path(__file__).parent.parent
        else:
            project_root = Path(project_root)
        
        self.project_root = project_root
        self.strategies_dir = project_root / "configs" / "strategies"
        self.data_dir = project_root / "data" / "strategies"
        
        # Create directories if they don't exist
        self.strategies_dir.mkdir(parents=True, exist_ok=True)
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def create_strategy(self, strategy_name: str, description: str = "") -> str:
        """
        Create a new strategy
        
        Args:
            strategy_name: Name of the strategy
            description: Description of the strategy
            
        Returns:
            strategy_id: Unique strategy identifier
        """
        # Ensure strategy_name is not empty
        if not strategy_name or not strategy_name.strip():
            strategy_name = "未命名策略"
        
        # Generate strategy ID
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        strategy_id = f"strategy_{timestamp}"
        
        # Create strategy directory
        strategy_dir = self.strategies_dir / strategy_id
        strategy_dir.mkdir(parents=True, exist_ok=True)
        prompts_dir = strategy_dir / "prompts"
        prompts_dir.mkdir(parents=True, exist_ok=True)
        
        # Create base configuration
        base_config = {
            "strategy_id": strategy_id,
            "strategy_name": strategy_name,
            "description": description,
            "created_at": datetime.now().isoformat(),
            "status": "design",
            "agent_type": "BaseAgent",
            "date_range": {
                "init_date": "2025-01-01",
                "end_date": "2025-01-31"
            },
            "models": [
                {
                    "name": "deepseek-chat-v3.1",
                    "basemodel": "deepseek-chat",
                    "signature": "deepseek-chat-v3.1",
                    "enabled": True
                }
            ],
            "agent_config": {
                "max_steps": 30,
                "max_retries": 3,
                "base_delay": 1.0,
                "initial_cash": 10000.0
            },
            "log_config": {
                "log_path": f"./data/strategies/{strategy_id}"
            }
        }
        
        # Save base config
        config_file = strategy_dir / "base_config.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(base_config, f, indent=2, ensure_ascii=False)
        
        # Create default prompt (save as JSON)
        default_prompt = '''You are a stock fundamental analysis trading assistant.

Your goals are:
- Think and reason by calling available tools.
- You need to think about the prices of various stocks and their returns.
- Your long-term goal is to maximize returns through this portfolio.
- Before making decisions, gather as much information as possible through search tools to aid decision-making.

Thinking standards:
- Clearly show key intermediate steps:
  - Read input of yesterday's positions and today's prices
  - Update valuation and adjust weights for each target (if strategy requires)

Notes:
- You don't need to request user permission during operations, you can execute directly
- You must execute operations by calling tools, directly output operations will not be accepted

Here is the information you need:

Today's date:
{date}

Yesterday's closing positions (numbers after stock codes represent how many shares you hold, numbers after CASH represent your available cash):
{positions}

Yesterday's closing prices:
{yesterday_close_price}

Today's buying prices:
{today_buy_price}

When you think your task is complete, output
{STOP_SIGNAL}
'''
        
        # Save prompt as JSON
        prompt_file = prompts_dir / "base_prompt.json"
        prompt_config = {
            "prompt": default_prompt,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        with open(prompt_file, 'w', encoding='utf-8') as f:
            json.dump(prompt_config, f, indent=2, ensure_ascii=False)
        
        return strategy_id
    
    def get_strategy_config(self, strategy_id: str, mode: TradingMode = "backtest") -> Dict:
        """
        Get strategy configuration for a specific mode
        
        Args:
            strategy_id: Strategy identifier
            mode: Trading mode (backtest, simulate, real)
            
        Returns:
            Configuration dictionary
        """
        strategy_dir = self.strategies_dir / strategy_id
        
        # Load base config
        base_config_file = strategy_dir / "base_config.json"
        if not base_config_file.exists():
            raise FileNotFoundError(f"Strategy {strategy_id} not found")
        
        with open(base_config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Load mode-specific config if exists
        mode_config_file = strategy_dir / f"{mode}_config.json"
        if mode_config_file.exists():
            with open(mode_config_file, 'r', encoding='utf-8') as f:
                mode_config = json.load(f)
                # Merge mode config into base config
                config.update(mode_config)
        
        # Set mode-specific settings
        if mode == "simulate":
            config["use_realtime_data"] = True
            config["moomoo_env"] = "SIMULATE"
        elif mode == "real":
            config["use_realtime_data"] = True
            config["moomoo_env"] = "REAL"
        
        return config
    
    def create_mode_config(self, strategy_id: str, mode: TradingMode, 
                          base_on_mode: Optional[TradingMode] = None) -> Dict:
        """
        Create mode-specific configuration
        
        Args:
            strategy_id: Strategy identifier
            mode: Target mode (backtest, simulate, real)
            base_on_mode: Base mode to inherit from (default: previous mode)
            
        Returns:
            Configuration dictionary
        """
        strategy_dir = self.strategies_dir / strategy_id
        
        # Determine base config
        if base_on_mode:
            base_config = self.get_strategy_config(strategy_id, base_on_mode)
        else:
            # Get base config
            base_config_file = strategy_dir / "base_config.json"
            with open(base_config_file, 'r', encoding='utf-8') as f:
                base_config = json.load(f)
        
        # Create mode-specific config
        mode_config = base_config.copy()
        
        if mode == "backtest":
            # Backtest uses historical data
            mode_config["date_range"] = {
                "init_date": "2025-01-01",
                "end_date": "2025-10-31"
            }
            mode_config["use_realtime_data"] = False
        
        elif mode == "simulate":
            # Simulate uses real-time data but simulated trading
            mode_config["date_range"] = {
                "init_date": datetime.now().strftime("%Y-%m-%d"),
                "end_date": datetime.now().strftime("%Y-%m-%d")
            }
            mode_config["use_realtime_data"] = True
            mode_config["moomoo_env"] = "SIMULATE"
        
        elif mode == "real":
            # Real uses real-time data and real trading
            mode_config["date_range"] = {
                "init_date": datetime.now().strftime("%Y-%m-%d"),
                "end_date": None  # Continuous
            }
            mode_config["use_realtime_data"] = True
            mode_config["moomoo_env"] = "REAL"
            mode_config["risk_control"] = {
                "max_daily_loss": 0.05,
                "max_position_size": 0.2,
                "stop_loss": 0.1
            }
        
        # Save mode config
        mode_config_file = strategy_dir / f"{mode}_config.json"
        with open(mode_config_file, 'w', encoding='utf-8') as f:
            json.dump(mode_config, f, indent=2, ensure_ascii=False)
        
        return mode_config
    
    def list_strategies(self) -> List[Dict]:
        """List all strategies"""
        strategies = []
        
        if not self.strategies_dir.exists():
            return strategies
        
        for strategy_dir in self.strategies_dir.iterdir():
            if not strategy_dir.is_dir():
                continue
            
            config_file = strategy_dir / "base_config.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    strategies.append({
                        "strategy_id": config.get("strategy_id"),
                        "strategy_name": config.get("strategy_name"),
                        "description": config.get("description"),
                        "status": config.get("status"),
                        "created_at": config.get("created_at")
                    })
        
        return sorted(strategies, key=lambda x: x.get("created_at", ""), reverse=True)
    
    def get_strategy_data_path(self, strategy_id: str, mode: TradingMode) -> Path:
        """Get data path for strategy and mode"""
        return self.data_dir / strategy_id / mode / "agent_data"
    
    def update_strategy_status(self, strategy_id: str, status: str):
        """Update strategy status"""
        strategy_dir = self.strategies_dir / strategy_id
        config_file = strategy_dir / "base_config.json"
        
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            config["status"] = status
            config["updated_at"] = datetime.now().isoformat()
            
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
    
    def delete_strategy(self, strategy_id: str) -> bool:
        """
        Delete a strategy and all its data
        
        Args:
            strategy_id: Strategy identifier
            
        Returns:
            True if deletion successful, False otherwise
        """
        import shutil
        import glob
        
        try:
            # Delete strategy config directory
            strategy_config_dir = self.strategies_dir / strategy_id
            if strategy_config_dir.exists():
                shutil.rmtree(strategy_config_dir)
                print(f"✅ Deleted strategy config: {strategy_config_dir}")
            
            # Delete strategy data directory
            strategy_data_dir = self.data_dir / strategy_id
            if strategy_data_dir.exists():
                shutil.rmtree(strategy_data_dir)
                print(f"✅ Deleted strategy data: {strategy_data_dir}")
            
            # Delete runtime config files in configs directory
            configs_dir = self.project_root / "configs"
            runtime_pattern = f"runtime_{strategy_id}_*.json"
            runtime_files = list(configs_dir.glob(runtime_pattern))
            for runtime_file in runtime_files:
                try:
                    runtime_file.unlink()
                    print(f"✅ Deleted runtime config: {runtime_file}")
                except Exception as e:
                    print(f"⚠️  Warning: Could not delete runtime config {runtime_file}: {e}")
            
            # Delete log files
            logs_dir = self.project_root / "logs"
            if logs_dir.exists():
                # Delete log files: {strategy_id}_{mode}.log
                log_pattern = f"{strategy_id}_*.log"
                log_files = list(logs_dir.glob(log_pattern))
                for log_file in log_files:
                    try:
                        log_file.unlink()
                        print(f"✅ Deleted log file: {log_file}")
                    except Exception as e:
                        print(f"⚠️  Warning: Could not delete log file {log_file}: {e}")
                
                # Delete process info files: {strategy_id}_{mode}_process.json
                process_pattern = f"{strategy_id}_*_process.json"
                process_files = list(logs_dir.glob(process_pattern))
                for process_file in process_files:
                    try:
                        process_file.unlink()
                        print(f"✅ Deleted process info: {process_file}")
                    except Exception as e:
                        print(f"⚠️  Warning: Could not delete process info {process_file}: {e}")
                
                # Delete progress files: {strategy_id}_{mode}_progress.json
                progress_pattern = f"{strategy_id}_*_progress.json"
                progress_files = list(logs_dir.glob(progress_pattern))
                for progress_file in progress_files:
                    try:
                        progress_file.unlink()
                        print(f"✅ Deleted progress file: {progress_file}")
                    except Exception as e:
                        print(f"⚠️  Warning: Could not delete progress file {progress_file}: {e}")
            
            return True
        except Exception as e:
            import traceback
            print(f"❌ Error deleting strategy {strategy_id}: {e}")
            print(traceback.format_exc())
            return False

