#!/usr/bin/env python3
"""
Run Management Module
Handles running strategies in different modes
"""

import os
import sys
import json
import time
import subprocess
from pathlib import Path
from typing import Dict, Optional, Literal
from strategy_manager import StrategyManager, TradingMode

# Import service manager to check MCP services
try:
    from service_manager import ServiceManager
except ImportError:
    ServiceManager = None

class RunManager:
    """Manage strategy execution in different modes"""
    
    def __init__(self, project_root: Optional[str] = None):
        self.project_root = Path(project_root) if project_root else Path(__file__).parent.parent
        self.strategy_manager = StrategyManager(project_root)
        if ServiceManager:
            self.service_manager = ServiceManager(project_root)
        else:
            self.service_manager = None
    
    def prepare_run(self, strategy_id: str, mode: TradingMode) -> Dict:
        """
        Prepare configuration for running a strategy in a specific mode
        
        Args:
            strategy_id: Strategy identifier
            mode: Trading mode
            
        Returns:
            Configuration dictionary and paths
        """
        # Get strategy config for the mode
        config = self.strategy_manager.get_strategy_config(strategy_id, mode)
        
        # Get data path
        data_path = self.strategy_manager.get_strategy_data_path(strategy_id, mode)
        
        # Get prompt path
        strategy_dir = self.strategy_manager.strategies_dir / strategy_id
        prompt_file = strategy_dir / "prompts" / f"{mode}_prompt.py"
        if not prompt_file.exists():
            prompt_file = strategy_dir / "prompts" / "base_prompt.py"
        
        return {
            "config": config,
            "data_path": data_path,
            "prompt_path": prompt_file,
            "config_path": strategy_dir / f"{mode}_config.json"
        }
    
    def run_strategy(self, strategy_id: str, mode: TradingMode) -> Dict:
        """
        Run a strategy in a specific mode
        
        Args:
            strategy_id: Strategy identifier
            mode: Trading mode
            
        Returns:
            Run information
        """
        # Check and start MCP services if needed
        if self.service_manager:
            mcp_status = self.service_manager.check_mcp_services()
            if not all(mcp_status.values()):
                print("⚠️  Some MCP services are not running. Starting MCP services...")
                start_result = self.service_manager.start_mcp_services()
                if not start_result.get("success"):
                    return {
                        "success": False,
                        "error": f"Failed to start MCP services: {start_result.get('error')}",
                        "mcp_status": mcp_status
                    }
                # Wait for services to be ready
                time.sleep(3)
        
        # Prepare configuration
        run_info = self.prepare_run(strategy_id, mode)
        
        # Update strategy status
        status_map = {
            "backtest": "backtest",
            "simulate": "simulate",
            "real": "real"
        }
        self.strategy_manager.update_strategy_status(strategy_id, status_map[mode])
        
        # Set environment variables
        env = os.environ.copy()
        env["STRATEGY_ID"] = strategy_id
        env["TRADING_MODE"] = mode
        env["DATA_PATH"] = str(run_info["data_path"])
        
        if mode in ["simulate", "real"]:
            env["USE_MOOMOO"] = "true"
            env["MOOMOO_TRD_ENV"] = run_info["config"].get("moomoo_env", "SIMULATE")
        
        # Create config file for main.py
        config_file = self.project_root / "configs" / f"runtime_{strategy_id}_{mode}.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(run_info["config"], f, indent=2, ensure_ascii=False)
        
        # Start main.py with the config
        main_py = self.project_root / "main.py"
        process = subprocess.Popen(
            [sys.executable, str(main_py), str(config_file)],
            cwd=str(self.project_root),
            env=env
        )
        
        return {
            "strategy_id": strategy_id,
            "mode": mode,
            "process_id": process.pid,
            "config_file": str(config_file),
            "status": "running"
        }
    
    def get_run_results(self, strategy_id: str, mode: str) -> Optional[Dict]:
        """
        Get execution results for a strategy in a specific mode
        
        Args:
            strategy_id: Strategy identifier
            mode: Trading mode (backtest, simulate, real)
            
        Returns:
            Dictionary containing results data or None if no results
        """
        try:
            # Get data path for the strategy (already includes agent_data)
            data_path = self.strategy_manager.get_strategy_data_path(strategy_id, mode)
            
            if not data_path.exists():
                return None
            
            results = {
                "asset_evolution": None,
                "portfolio": None,
                "metrics": None,
                "trades": []
            }
            
            # Load asset evolution data
            asset_file = data_path / "asset_evolution.json"
            if asset_file.exists():
                with open(asset_file, 'r', encoding='utf-8') as f:
                    asset_data = json.load(f)
                    results["asset_evolution"] = asset_data
                    
                    # Calculate metrics from asset data
                    if asset_data and len(asset_data) > 0:
                        initial_value = asset_data[0].get("total_value", 10000)
                        current_value = asset_data[-1].get("total_value", initial_value)
                        results["metrics"] = {
                            "initial_value": initial_value,
                            "current_value": current_value,
                            "total_return": ((current_value - initial_value) / initial_value) * 100,
                            "num_trades": len(asset_data) - 1,
                            "start_date": asset_data[0].get("date"),
                            "end_date": asset_data[-1].get("date")
                        }
            
            # Load portfolio data
            portfolio_file = data_path / "portfolio.json"
            if portfolio_file.exists():
                with open(portfolio_file, 'r', encoding='utf-8') as f:
                    results["portfolio"] = json.load(f)
            
            # Load trades data
            trades_file = data_path / "trades.json"
            if trades_file.exists():
                with open(trades_file, 'r', encoding='utf-8') as f:
                    results["trades"] = json.load(f)
            
            # Check if we have any data
            if not any([results["asset_evolution"], results["portfolio"], results["trades"]]):
                return None
            
            return results
            
        except Exception as e:
            print(f"Error loading results for {strategy_id}/{mode}: {e}")
            return None

