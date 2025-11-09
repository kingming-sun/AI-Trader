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
from dotenv import load_dotenv
from strategy_manager import StrategyManager, TradingMode

# Load environment variables from .env file
load_dotenv()

# Import psutil with error handling
try:
    import psutil
except ImportError:
    psutil = None
    print("⚠️  Warning: psutil module not installed. Please run: pip install psutil")

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
        # For backtest mode, just log a note about data availability
        if mode == "backtest":
            print("📅 Running backtest mode - will use local data when available, API fallback for missing data")
        
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
        
        # Create log file for stdout/stderr
        log_file = self.project_root / "logs" / f"{strategy_id}_{mode}.log"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        # Clear old log file
        if log_file.exists():
            log_file.unlink()
        
        # Start main.py with the config, redirecting stdout and stderr to log file
        main_py = self.project_root / "main.py"
        # Open log file in write mode (not append, since we cleared it)
        # Use unbuffered mode to ensure immediate writes
        log_f = open(log_file, 'w', encoding='utf-8', buffering=1)  # Line buffered
        process = subprocess.Popen(
            [sys.executable, '-u', str(main_py), str(config_file)],  # -u for unbuffered output
            cwd=str(self.project_root),
            env=env,
            stdout=log_f,
            stderr=subprocess.STDOUT,  # Redirect stderr to stdout
            text=True  # Text mode
        )
        # Flush immediately to ensure first writes appear
        log_f.flush()
        # Note: log_f will be closed when process terminates
        # Store log file handle in process info for potential cleanup
        
        # Store process info for status checking
        process_info_file = self.project_root / "logs" / f"{strategy_id}_{mode}_process.json"
        process_info_file.parent.mkdir(parents=True, exist_ok=True)
        with open(process_info_file, 'w', encoding='utf-8') as f:
            json.dump({
                "strategy_id": strategy_id,
                "mode": mode,
                "process_id": process.pid,
                "config_file": str(config_file),
                "start_time": time.time(),
                "status": "running"
            }, f, indent=2)
        
        # Clean up old progress file if exists
        progress_file = self.project_root / "logs" / f"{strategy_id}_{mode}_progress.json"
        if progress_file.exists():
            progress_file.unlink()
        
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
            else:
                # If asset_evolution.json doesn't exist yet, try to generate it from position data
                # This allows real-time updates during backtest
                position_file = data_path / "position" / "position.jsonl"
                if position_file.exists():
                    try:
                        from tools.result_generator import load_position_data, generate_asset_evolution
                        # Get initial_cash from config if available
                        initial_cash = 10000.0
                        try:
                            config_file = self.project_root / "configs" / f"runtime_{strategy_id}_{mode}.json"
                            if config_file.exists():
                                with open(config_file, 'r', encoding='utf-8') as f:
                                    config = json.load(f)
                                    initial_cash = config.get("agent_config", {}).get("initial_cash", 10000.0)
                        except:
                            pass
                        
                        positions = load_position_data(str(data_path))
                        if positions:
                            asset_data = generate_asset_evolution(positions, initial_cash)
                            results["asset_evolution"] = asset_data
                            
                            # Calculate metrics
                            if asset_data and len(asset_data) > 0:
                                initial_value = asset_data[0].get("total_value", initial_cash)
                                current_value = asset_data[-1].get("total_value", initial_value)
                                results["metrics"] = {
                                    "initial_value": initial_value,
                                    "current_value": current_value,
                                    "total_return": ((current_value - initial_value) / initial_value) * 100,
                                    "num_trades": len(asset_data) - 1,
                                    "start_date": asset_data[0].get("date"),
                                    "end_date": asset_data[-1].get("date")
                                }
                    except Exception as e:
                        print(f"⚠️  Failed to generate asset evolution from position data: {e}")
            
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
    
    def check_run_status(self, strategy_id: str, mode: str) -> Dict:
        """
        Check if a strategy is currently running
        
        Args:
            strategy_id: Strategy identifier
            mode: Trading mode
            
        Returns:
            Dictionary with status information
        """
        try:
            process_info_file = self.project_root / "logs" / f"{strategy_id}_{mode}_process.json"
            
            if not process_info_file.exists():
                return {
                    "is_running": False,
                    "status": "not_started",
                    "message": "策略未启动"
                }
            
            with open(process_info_file, 'r', encoding='utf-8') as f:
                process_info = json.load(f)
            
            process_id = process_info.get("process_id")
            if not process_id:
                return {
                    "is_running": False,
                    "status": "unknown",
                    "message": "进程信息不完整"
                }
            
            # Check if process is still running
            if psutil is None:
                return {
                    "is_running": False,
                    "status": "error",
                    "message": "psutil 模块未安装，无法检查进程状态。请运行: pip install psutil"
                }
            
            try:
                process = psutil.Process(process_id)
                if process.is_running():
                    # Check if it's actually our main.py process
                    cmdline = process.cmdline()
                    if any("main.py" in str(cmd) for cmd in cmdline):
                        # Try to get detailed progress information
                        data_path = self.strategy_manager.get_strategy_data_path(strategy_id, mode)
                        progress_info = self._get_progress_info(strategy_id, mode, data_path)
                        
                        return {
                            "is_running": True,
                            "status": "running",
                            "process_id": process_id,
                            "start_time": process_info.get("start_time"),
                            "progress": progress_info.get("progress", 0),
                            "current_date": progress_info.get("current_date"),
                            "total_dates": progress_info.get("total_dates", 0),
                            "processed_dates": progress_info.get("processed_dates", 0),
                            "latest_log": progress_info.get("latest_log"),
                            "message": f"策略正在运行中... ({progress_info.get('progress', 0)}%)"
                        }
            except Exception as e:
                # Handle psutil exceptions (NoSuchProcess, AccessDenied, etc.)
                if psutil is not None:
                    if isinstance(e, (psutil.NoSuchProcess, psutil.AccessDenied)):
                        pass
                    else:
                        print(f"Error checking process: {e}")
                else:
                    pass
            
            # Process is not running, check progress and results
            data_path = self.strategy_manager.get_strategy_data_path(strategy_id, mode)
            progress_info = self._get_progress_info(strategy_id, mode, data_path)
            results = self.get_run_results(strategy_id, mode)
            
            if results:
                return {
                    "is_running": False,
                    "status": "completed",
                    "message": "策略运行已完成",
                    "has_results": True,
                    "progress": 100,
                    "current_date": progress_info.get("current_date"),
                    "total_dates": progress_info.get("total_dates", 0),
                    "processed_dates": progress_info.get("processed_dates", 0)
                }
            elif progress_info.get("progress", 0) > 0:
                # Has partial progress but stopped
                return {
                    "is_running": False,
                    "status": "stopped",
                    "message": f"策略已停止 (进度: {progress_info.get('progress', 0)}%)",
                    "progress": progress_info.get("progress", 0),
                    "current_date": progress_info.get("current_date"),
                    "total_dates": progress_info.get("total_dates", 0),
                    "processed_dates": progress_info.get("processed_dates", 0),
                    "latest_log": progress_info.get("latest_log")
                }
            else:
                return {
                    "is_running": False,
                    "status": "failed",
                    "message": "策略运行已结束，但未生成结果",
                    "progress": 0
                }
                
        except Exception as e:
            return {
                "is_running": False,
                "status": "error",
                "message": f"检查状态时出错: {str(e)}"
            }
    
    def _get_progress_info(self, strategy_id: str, mode: str, data_path: Path) -> Dict:
        """Get detailed progress information from logs and position data"""
        try:
            progress_info = {
                "progress": 0,
                "current_date": None,
                "total_dates": 0,
                "processed_dates": 0,
                "latest_log": None
            }
            
            # Check progress file first (persistent storage)
            progress_file = self.project_root / "logs" / f"{strategy_id}_{mode}_progress.json"
            if progress_file.exists():
                try:
                    with open(progress_file, 'r', encoding='utf-8') as f:
                        saved_progress = json.load(f)
                        progress_info.update(saved_progress)
                except:
                    pass
            
            # Try to get latest log from stdout log file first
            stdout_log_file = self.project_root / "logs" / f"{strategy_id}_{mode}.log"
            if stdout_log_file.exists():
                try:
                    with open(stdout_log_file, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        if lines:
                            # Get the last few non-empty lines (for better context)
                            recent_lines = []
                            for line in reversed(lines[-20:]):  # Check last 20 lines
                                line = line.strip()
                                if line and not line.startswith('#'):
                                    recent_lines.insert(0, line)
                                    if len(recent_lines) >= 3:  # Get last 3 meaningful lines
                                        break
                            if recent_lines:
                                # Join last few lines for better context
                                latest_log = ' | '.join(recent_lines[-2:])  # Last 2 lines
                                if len(latest_log) > 400:
                                    latest_log = latest_log[:400] + "..."
                                progress_info["latest_log"] = latest_log
                except Exception as e:
                    print(f"Error reading stdout log: {e}")
            
            # Try to get progress from config and position data
            config_file = self.project_root / "configs" / f"runtime_{strategy_id}_{mode}.json"
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    date_range = config.get("date_range", {})
                    
                    if date_range:
                        from datetime import datetime, timedelta
                        start_date = datetime.strptime(date_range.get("init_date", ""), "%Y-%m-%d")
                        end_date = datetime.strptime(date_range.get("end_date", ""), "%Y-%m-%d")
                        
                        # Count trading days (exclude weekends)
                        current = start_date
                        total_days = 0
                        while current <= end_date:
                            if current.weekday() < 5:  # Monday = 0, Friday = 4
                                total_days += 1
                            current += timedelta(days=1)
                        
                        progress_info["total_dates"] = total_days
                        
                        # Check position file for processed dates
                        position_file = data_path / "position" / "position.jsonl"
                        if position_file.exists():
                            with open(position_file, 'r', encoding='utf-8') as f:
                                lines = f.readlines()
                                
                                # Only count dates within the configured date range
                                processed_dates_in_range = []
                                for line in lines:
                                    if not line.strip():
                                        continue
                                    try:
                                        position = json.loads(line)
                                        pos_date_str = position.get("date", "")
                                        if pos_date_str:
                                            pos_date = datetime.strptime(pos_date_str, "%Y-%m-%d")
                                            # Only count dates within the configured range
                                            if start_date <= pos_date <= end_date:
                                                processed_dates_in_range.append(pos_date_str)
                                    except:
                                        continue
                                
                                progress_info["processed_dates"] = len(processed_dates_in_range)
                                
                                # Get the latest date within the range
                                if processed_dates_in_range:
                                    # Sort dates to get the latest one
                                    sorted_dates = sorted(processed_dates_in_range)
                                    progress_info["current_date"] = sorted_dates[-1]
                        
                        # Calculate progress
                        if progress_info["total_dates"] > 0:
                            progress_info["progress"] = int((progress_info["processed_dates"] / progress_info["total_dates"]) * 100)
            
            # Get latest log entry (pass strategy_id and mode for better reliability)
            progress_info["latest_log"] = self._get_latest_log_entry(data_path, strategy_id, mode)
            
            # Save progress for persistence
            with open(progress_file, 'w', encoding='utf-8') as f:
                json.dump(progress_info, f, indent=2)
            
            return progress_info
            
        except Exception as e:
            print(f"Error getting progress info: {e}")
            return {
                "progress": 0,
                "current_date": None,
                "total_dates": 0,
                "processed_dates": 0,
                "latest_log": None
            }
    
    def _get_latest_log_entry(self, data_path: Path, strategy_id: Optional[str] = None, mode: Optional[str] = None) -> Optional[str]:
        """Get the latest log entry from log files and stdout log"""
        try:
            # First, try to get from stdout log file (real-time output)
            # Extract strategy_id and mode from path if not provided
            if not strategy_id or not mode:
                if "strategies" in str(data_path):
                    # Path structure: data/strategies/{strategy_id}/{mode}/agent_data
                    parts = data_path.parts
                    try:
                        strategies_idx = parts.index("strategies")
                        if strategies_idx + 2 < len(parts):
                            strategy_id = parts[strategies_idx + 1]
                            mode = parts[strategies_idx + 2]
                    except (ValueError, IndexError):
                        pass
            
            if strategy_id and mode:
                stdout_log_file = self.project_root / "logs" / f"{strategy_id}_{mode}.log"
                if stdout_log_file.exists():
                    try:
                        # Read last few lines from stdout log
                        with open(stdout_log_file, 'r', encoding='utf-8') as f:
                            lines = f.readlines()
                            if lines:
                                # Get the last non-empty line
                                for line in reversed(lines):
                                    line = line.strip()
                                    if line and not line.startswith('#'):
                                        # Truncate if too long
                                        if len(line) > 300:
                                            line = line[:300] + "..."
                                        return line
                    except Exception as e:
                        print(f"Error reading stdout log: {e}")
            
            # Fallback: try to get from JSONL log file
            log_dir = data_path / "log"
            if not log_dir.exists():
                return None
            
            # Get date range from config if available
            date_range = None
            if strategy_id and mode:
                try:
                    config_file = self.project_root / "configs" / f"runtime_{strategy_id}_{mode}.json"
                    if config_file.exists():
                        with open(config_file, 'r', encoding='utf-8') as f:
                            config = json.load(f)
                            date_range = config.get("date_range", {})
                except:
                    pass
            
            # Find date directories, filter by date range if available
            date_dirs = []
            for d in log_dir.iterdir():
                if d.is_dir():
                    if date_range:
                        # Only include dates within the configured range
                        try:
                            from datetime import datetime
                            dir_date = datetime.strptime(d.name, "%Y-%m-%d")
                            start_date = datetime.strptime(date_range.get("init_date", ""), "%Y-%m-%d")
                            end_date = datetime.strptime(date_range.get("end_date", ""), "%Y-%m-%d")
                            if start_date <= dir_date <= end_date:
                                date_dirs.append(d)
                        except:
                            # If date parsing fails, include it anyway
                            date_dirs.append(d)
                    else:
                        date_dirs.append(d)
            
            if not date_dirs:
                return None
            
            # Find the most recent date directory within range
            date_dirs = sorted(date_dirs, key=lambda x: x.name, reverse=True)
            latest_date_dir = date_dirs[0]
            log_file = latest_date_dir / "log.jsonl"
            
            if not log_file.exists():
                return None
            
            # Read the last few lines
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                if lines:
                    # Get the last log entry
                    last_line = lines[-1].strip()
                    if last_line:
                        try:
                            log_entry = json.loads(last_line)
                            messages = log_entry.get("new_messages", [])
                            if messages:
                                # Get the last message content
                                last_msg = messages[-1]
                                content = last_msg.get("content", "")
                                # Truncate if too long
                                if len(content) > 200:
                                    content = content[:200] + "..."
                                return content
                        except:
                            pass
            
            return None
        except Exception as e:
            print(f"Error getting latest log: {e}")
            return None

