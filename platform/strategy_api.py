#!/usr/bin/env python3
"""
Strategy Management API
Flask API for strategy management and mode switching
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load env vars from AI-Trader root or project root
env_path = Path(__file__).parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).parent.parent.parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).parent.parent.parent / "stock_hackthon" / "backend" / ".env"

load_dotenv(env_path)

from flask import Flask, request, jsonify
from flask_cors import CORS

# Add platform directory to path
platform_dir = Path(__file__).parent
sys.path.insert(0, str(platform_dir))

# Add stock_hackthon directory to path for backend imports
stock_hackthon_dir = Path(__file__).parent.parent.parent / "stock_hackthon"
if stock_hackthon_dir.exists():
    sys.path.insert(0, str(stock_hackthon_dir))

from strategy_manager import StrategyManager, TradingMode
from run_manager import RunManager
from service_manager import ServiceManager

app = Flask(__name__)
CORS(app)

# Initialize managers
strategy_manager = StrategyManager()
run_manager = RunManager()
service_manager = ServiceManager()

@app.route('/api/strategies', methods=['GET'])
def list_strategies():
    """List all strategies"""
    try:
        strategies = strategy_manager.list_strategies()
        return jsonify({"success": True, "strategies": strategies})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies', methods=['POST'])
def create_strategy():
    """Create a new strategy"""
    try:
        data = request.get_json()
        strategy_name = data.get('strategy_name', '').strip()
        description = data.get('description', '').strip()
        
        # If strategy_name is empty, use default name
        if not strategy_name:
            strategy_name = '未命名策略'
        
        strategy_id = strategy_manager.create_strategy(strategy_name, description)
        return jsonify({
            "success": True,
            "strategy_id": strategy_id,
            "message": "Strategy created successfully"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>', methods=['GET'])
def get_strategy(strategy_id):
    """Get strategy details"""
    try:
        config = strategy_manager.get_strategy_config(strategy_id, "backtest")
        return jsonify({"success": True, "config": config})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>', methods=['DELETE'])
def delete_strategy(strategy_id):
    """Delete a strategy and all its data"""
    try:
        # Check if strategy is running and stop it if necessary
        stopped_modes = []
        for mode in ['backtest', 'simulate', 'real']:
            try:
                status = run_manager.check_run_status(strategy_id, mode)
                if status.get('is_running', False):
                    # Stop the running strategy
                    stop_result = run_manager.stop_strategy(strategy_id, mode)
                    if stop_result.get('success'):
                        stopped_modes.append(mode)
            except Exception as e:
                print(f"Warning: Could not check/stop strategy in {mode} mode: {e}")
        
        # Delete strategy
        result = strategy_manager.delete_strategy(strategy_id)
        
        if result:
            message = f"Strategy {strategy_id} deleted successfully"
            if stopped_modes:
                message += f" (已停止运行中的模式: {', '.join(stopped_modes)})"
            return jsonify({
                "success": True,
                "message": message,
                "stopped_modes": stopped_modes
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to delete strategy"
            }), 500
    except Exception as e:
        import traceback
        print(f"Error deleting strategy: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/config/<mode>', methods=['GET'])
def get_strategy_config(strategy_id, mode):
    """Get strategy configuration for a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        config = strategy_manager.get_strategy_config(strategy_id, mode)
        
        # Ensure the config has the expected structure
        # Frontend expects: { agent_config: {...}, date_range: {...} }
        result_config = {
            "agent_config": config.get("agent_config", {
                "max_steps": 30,
                "max_retries": 3,
                "base_delay": 1.0,
                "initial_cash": 10000
            }),
            "date_range": config.get("date_range", {
                "init_date": "",
                "end_date": ""
            })
        }
        
        return jsonify({"success": True, "config": result_config})
    except FileNotFoundError:
        # Strategy not found, return default config
        return jsonify({
            "success": True,
            "config": {
                "agent_config": {
                    "max_steps": 30,
                    "max_retries": 3,
                    "base_delay": 1.0,
                    "initial_cash": 10000
                },
                "date_range": {
                    "init_date": "",
                    "end_date": ""
                }
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/config/<mode>', methods=['POST', 'PUT'])
def save_strategy_config(strategy_id, mode):
    """Save strategy configuration for a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
        
        # Handle both formats: {config: {...}} or direct config object
        config = data.get('config', data)
        
        # Always merge with existing config to preserve other settings
        try:
            existing_config = strategy_manager.get_strategy_config(strategy_id, mode)
            # Merge: existing config as base, new config overrides
            merged_config = existing_config.copy()
            merged_config.update(config)
            config = merged_config
        except:
            # If no existing config, try to load base config
            try:
                strategy_dir = strategy_manager.strategies_dir / strategy_id
                base_config_file = strategy_dir / "base_config.json"
                if base_config_file.exists():
                    with open(base_config_file, 'r', encoding='utf-8') as f:
                        base_config = json.load(f)
                        # Merge base config with new config
                        base_config.update(config)
                        config = base_config
            except:
                # If still no config, ensure at least basic structure
                if not config or config == {}:
                    config = {}
        
        # Ensure config has required structure
        if 'date_range' not in config:
            config['date_range'] = {}
        if 'agent_config' not in config:
            config['agent_config'] = {
                "max_steps": 30,
                "max_retries": 3,
                "base_delay": 1.0,
                "initial_cash": 10000.0
            }
        
        # Save config to file
        strategy_dir = strategy_manager.strategies_dir / strategy_id
        strategy_dir.mkdir(parents=True, exist_ok=True)
        config_file = strategy_dir / f"{mode}_config.json"
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return jsonify({"success": True, "message": "Config saved successfully"})
    except Exception as e:
        import traceback
        print(f"Error saving strategy config: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/run/<mode>', methods=['POST'])
def run_strategy(strategy_id, mode):
    """Run a strategy in a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        # Special confirmation for real trading
        if mode == "real":
            confirm = request.get_json().get('confirm', False)
            if not confirm:
                return jsonify({
                    "success": False,
                    "error": "Real trading requires confirmation",
                    "requires_confirmation": True
                }), 400
        
        run_info = run_manager.run_strategy(strategy_id, mode)
        return jsonify({"success": True, "run_info": run_info})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/prompt/<mode>', methods=['GET'])
def get_strategy_prompt(strategy_id, mode):
    """Get strategy prompt for a specific mode"""
    try:
        strategy_dir = strategy_manager.strategies_dir / strategy_id
        prompts_dir = strategy_dir / "prompts"
        prompt_file = None
        
        # Try mode-specific JSON prompt first
        mode_prompt_json = prompts_dir / f"{mode}_prompt.json"
        if mode_prompt_json.exists():
            prompt_file = mode_prompt_json
        
        # Fallback to base JSON prompt
        if not prompt_file or not prompt_file.exists():
            base_prompt_json = prompts_dir / "base_prompt.json"
            if base_prompt_json.exists():
                prompt_file = base_prompt_json
        
        # Compatibility: Try old Python format if JSON doesn't exist
        if not prompt_file or not prompt_file.exists():
            mode_prompt_py = prompts_dir / f"{mode}_prompt.py"
            if mode_prompt_py.exists():
                prompt_file = mode_prompt_py
            else:
                base_prompt_py = prompts_dir / "base_prompt.py"
                if base_prompt_py.exists():
                    prompt_file = base_prompt_py
        
        if not prompt_file or not prompt_file.exists():
            # Return default prompt if no file exists
            from prompts.agent_prompt import agent_system_prompt
            return jsonify({"success": True, "prompt": agent_system_prompt.strip()})
        
        # Read JSON format
        if prompt_file.suffix == '.json':
            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompt_data = json.load(f)
                prompt = prompt_data.get('prompt', '').strip()
                if prompt:
                    return jsonify({"success": True, "prompt": prompt})
        
        # Read old Python format (for compatibility)
        if prompt_file.suffix == '.py':
            with open(prompt_file, 'r', encoding='utf-8') as f:
                content = f.read()
                import re
                # Try to match the prompt pattern
                match = re.search(r'agent_system_prompt = """([\s\S]*?)"""', content)
                if match:
                    prompt = match.group(1).strip()
                    return jsonify({"success": True, "prompt": prompt})
                else:
                    # If pattern doesn't match, try to extract from triple quotes
                    match = re.search(r'"""([\s\S]*?)"""', content)
                    if match:
                        prompt = match.group(1).strip()
                        return jsonify({"success": True, "prompt": prompt})
        
        # Return default prompt if extraction fails
        from prompts.agent_prompt import agent_system_prompt
        return jsonify({"success": True, "prompt": agent_system_prompt.strip()})
    except Exception as e:
        import traceback
        print(f"Error getting prompt: {e}")
        print(traceback.format_exc())
        # Return default prompt on error
        try:
            from prompts.agent_prompt import agent_system_prompt
            return jsonify({"success": True, "prompt": agent_system_prompt.strip()})
        except:
            return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/prompt/<mode>', methods=['POST', 'PUT'])
def save_strategy_prompt(strategy_id, mode):
    """Save strategy prompt for a specific mode"""
    try:
        data = request.get_json()
        prompt_text = data.get('prompt', '').strip()
        
        strategy_dir = strategy_manager.strategies_dir / strategy_id
        prompts_dir = strategy_dir / "prompts"
        prompts_dir.mkdir(parents=True, exist_ok=True)
        
        # Save as JSON format
        prompt_file = prompts_dir / f"{mode}_prompt.json"
        
        # Load existing prompt config if exists, or create new
        prompt_config = {}
        if prompt_file.exists():
            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompt_config = json.load(f)
        
        # Update prompt and metadata
        prompt_config['prompt'] = prompt_text
        prompt_config['updated_at'] = datetime.now().isoformat()
        if 'created_at' not in prompt_config:
            prompt_config['created_at'] = datetime.now().isoformat()
        
        with open(prompt_file, 'w', encoding='utf-8') as f:
            json.dump(prompt_config, f, indent=2, ensure_ascii=False)
        
        return jsonify({"success": True, "message": "Prompt saved successfully"})
    except Exception as e:
        import traceback
        print(f"Error saving prompt: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/services/status', methods=['GET'])
def get_services_status():
    """Get status of all platform services"""
    try:
        status = service_manager.get_all_services_status()
        
        # Get tools from all MCP services
        try:
            import asyncio
            tools = asyncio.run(service_manager.get_mcp_tools())
            status['mcp_tools'] = tools
            print(f"✅ MCP tools retrieved: {list(tools.keys())}")
        except Exception as e:
            # If getting tools fails, continue without tools info
            status['mcp_tools'] = {}
            print(f"⚠️ Warning: Failed to get MCP tools: {e}")
            import traceback
            traceback.print_exc()
        
        return jsonify({"success": True, "status": status})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/services/tools', methods=['GET'])
def get_mcp_tools():
    """Get tools from all MCP services"""
    try:
        import asyncio
        tools = asyncio.run(service_manager.get_mcp_tools())
        return jsonify({"success": True, "tools": tools})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/services/<service_name>/tools', methods=['GET'])
def get_service_tools(service_name):
    """Get detailed tools information for a specific service"""
    try:
        import asyncio
        all_tools = asyncio.run(service_manager.get_mcp_tools())
        
        if service_name in all_tools:
            service_info = all_tools[service_name]
            return jsonify({
                "success": True,
                "service": service_name,
                "tools": service_info.get('tools_detail', []),
                "count": service_info.get('count', 0),
                "type": service_info.get('type', 'unknown'),
                "note": service_info.get('note', '')  # Include note if connection failed
            })
        else:
            return jsonify({"success": False, "error": f"Service {service_name} not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/services/mcp/start', methods=['POST'])
def start_mcp_services():
    """Start MCP services"""
    try:
        result = service_manager.start_mcp_services()
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/services/mcp/stop', methods=['POST'])
def stop_mcp_services():
    """Stop MCP services"""
    try:
        result = service_manager.stop_mcp_services()
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/results/<mode>', methods=['GET'])
def get_strategy_results(strategy_id, mode):
    """Get strategy execution results for a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        # Get results from run manager
        results = run_manager.get_run_results(strategy_id, mode)
        
        if results is None:
            return jsonify({
                "success": True,
                "has_data": False,
                "message": f"No results available for {mode} mode"
            })
        
        # Check if results contain error information
        if results.get("has_error"):
            return jsonify({
                "success": True,
                "has_data": False,
                "error": results.get("error", "Unknown error"),
                "message": f"Backtest failed: {results.get('error', 'Unknown error')}"
            })
        
        return jsonify({
            "success": True,
            "has_data": True,
            "results": results
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/logs/dates/<mode>', methods=['GET'])
def get_log_dates(strategy_id, mode):
    """Get available log dates for a strategy in a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        # Try multiple possible log paths
        # 1. New strategy structure: data/strategies/{strategy_id}/{mode}/agent_data/{signature}/log/
        # 2. Old structure: data/data/agent_data/{signature}/log/
        # 3. Direct structure: data/strategies/{strategy_id}/{mode}/agent_data/log/
        
        project_root = strategy_manager.project_root
        dates = []
        
        # Try new strategy structure first
        strategy_log_path = strategy_manager.get_strategy_data_path(strategy_id, mode) / "log"
        if strategy_log_path.exists():
            for date_dir in strategy_log_path.iterdir():
                if date_dir.is_dir() and (date_dir / "log.jsonl").exists():
                    dates.append(date_dir.name)
        
        # Try old structure: data/data/agent_data/{signature}/log/
        # This is for backward compatibility with existing data
        old_log_base = project_root / "data" / "data" / "agent_data"
        if old_log_base.exists():
            for signature_dir in old_log_base.iterdir():
                if signature_dir.is_dir():
                    old_log_dir = signature_dir / "log"
                    if old_log_dir.exists():
                        for date_dir in old_log_dir.iterdir():
                            if date_dir.is_dir() and (date_dir / "log.jsonl").exists():
                                if date_dir.name not in dates:
                                    dates.append(date_dir.name)
        
        # Remove duplicates and sort
        dates = sorted(list(set(dates)))
        return jsonify({"success": True, "dates": dates})
    except Exception as e:
        import traceback
        print(f"Error getting log dates: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/status/<mode>', methods=['GET'])
def get_strategy_status(strategy_id, mode):
    """Get strategy execution status"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        status = run_manager.check_run_status(strategy_id, mode)
        return jsonify({"success": True, "status": status})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/status', methods=['PUT'])
def update_strategy_status(strategy_id):
    """Update strategy status"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({"success": False, "error": "Status not provided"}), 400
        
        if new_status not in ["design", "backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid status"}), 400
        
        strategy_manager.update_strategy_status(strategy_id, new_status)
        return jsonify({"success": True, "message": "Status updated successfully"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/stop/<mode>', methods=['POST'])
def stop_strategy(strategy_id, mode):
    """Stop a running strategy"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        result = run_manager.stop_strategy(strategy_id, mode)
        return jsonify(result)
    except Exception as e:
        import traceback
        print(f"Error stopping strategy: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/resume/<mode>', methods=['POST'])
def resume_strategy(strategy_id, mode):
    """Resume a stopped strategy"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        result = run_manager.resume_strategy(strategy_id, mode)
        return jsonify(result)
    except Exception as e:
        import traceback
        print(f"Error resuming strategy: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/logs/<mode>/<date>', methods=['GET'])
def get_log_content(strategy_id, mode, date):
    """Get log content for a specific date"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        project_root = strategy_manager.project_root
        log_file = None
        
        # Try new strategy structure first
        strategy_log_file = strategy_manager.get_strategy_data_path(strategy_id, mode) / "log" / date / "log.jsonl"
        if strategy_log_file.exists():
            log_file = strategy_log_file
        
        # Try old structure: data/data/agent_data/{signature}/log/{date}/log.jsonl
        if log_file is None or not log_file.exists():
            old_log_base = project_root / "data" / "data" / "agent_data"
            if old_log_base.exists():
                for signature_dir in old_log_base.iterdir():
                    if signature_dir.is_dir():
                        old_log_file = signature_dir / "log" / date / "log.jsonl"
                        if old_log_file.exists():
                            log_file = old_log_file
                            break
        
        if log_file is None or not log_file.exists():
            return jsonify({"success": True, "logs": []})
        
        # Read log file (JSONL format)
        logs = []
        with open(log_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    log_entry = json.loads(line)
                    logs.append(log_entry)
                except json.JSONDecodeError:
                    continue
        
        return jsonify({"success": True, "logs": logs})
    except Exception as e:
        import traceback
        print(f"Error getting log content: {e}")
        print(traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/data/available-range', methods=['GET'])
def get_available_data_range():
    """Get available date range from local data"""
    try:
        # Add project root to path for imports
        project_root = Path(__file__).parent.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))
        
        from tools.data_validator import get_data_date_range
        
        # Check the data directory instead of a specific file
        data_dir = project_root / "data"
        if not data_dir.exists():
             return jsonify({
                "success": True,
                "available": False,
                "message": "数据目录不存在"
            })
            
        min_date, max_date = get_data_date_range(data_dir)
        
        if min_date and max_date:
            return jsonify({
                "success": True,
                "available": True,
                "start_date": min_date,
                "end_date": max_date,
                "message": f"本地数据范围: {min_date} 到 {max_date}",
                "api_fallback": True,
                "api_message": "可以选择超出本地范围的日期，缺失数据将自动从 Alpha Vantage API 获取"
            })
        else:
            return jsonify({
                "success": True,
                "available": False,
                "message": "本地没有可用的价格数据",
                "api_fallback": True,
                "api_message": "将完全依赖 Alpha Vantage API 获取数据"
            })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/restart-service', methods=['POST'])
def restart_service():
    """Restart the main service to apply new configuration"""
    try:
        data = request.get_json()
        strategy_id = data.get('strategy_id')
        config_mode = data.get('config_mode', 'backtest')  # Get from request, default to 'backtest'
        
        if not strategy_id:
            return jsonify({
                "success": False,
                "error": "策略ID未指定"
            }), 400
        
        # Validate config_mode
        if config_mode not in ['backtest', 'simulate', 'real']:
            config_mode = 'backtest'  # Default to backtest if invalid
        
        # TradingMode is a Literal type, so we can use the string directly
        trading_mode: TradingMode = config_mode  # type: ignore
        
        # Step 1: Stop the current strategy if running
        stopped_info = None
        # Try to stop strategy in all modes to ensure clean restart
        for mode_name in ['backtest', 'simulate', 'real']:
            stop_result = run_manager.stop_strategy(strategy_id, mode_name)
            if stop_result.get("success"):
                stopped_info = {
                    "mode": mode_name,
                    "message": stop_result.get("message", "已停止")
                }
                # Don't break - continue to check all modes
        
        # Wait a bit for process to fully terminate
        import time
        time.sleep(1)
        
        # Step 2: Restart the strategy with the current config mode
        try:
            run_result = run_manager.run_strategy(strategy_id, trading_mode)
            
            if "error" in run_result:
                return jsonify({
                    "success": False,
                    "error": run_result.get("error", "重启策略失败"),
                    "stopped_info": stopped_info
                }), 500
            
            return jsonify({
                "success": True,
                "message": f"服务已重启，策略 {strategy_id} 正在以 {config_mode} 模式运行",
                "strategy_id": strategy_id,
                "mode": config_mode,
                "process_id": run_result.get("process_id"),
                "stopped_info": stopped_info
            })
        except Exception as run_error:
            return jsonify({
                "success": False,
                "error": f"重启策略时出错: {str(run_error)}",
                "stopped_info": stopped_info
            }), 500
        
    except Exception as e:
        import traceback
        print(f"Error restarting service: {e}")
        print(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Moved to end of file

# ==================== 股票分析接口 (移植自 Stock Hackthon) ====================

import importlib
import logging

# Global variables
stock_analysis_agent = None
av_client = None
ACTIVE_AGENT = "none"

def initialize_analysis_agent():
    global stock_analysis_agent, av_client, ACTIVE_AGENT
    logger = logging.getLogger(__name__)
    
    # 优先使用 ReAct Agent，失败则回退到 LangGraph Agent
    try:
        import backend.react_agent_service
        importlib.reload(backend.react_agent_service)
        from backend.react_agent_service import stock_analysis_agent as _react_agent, av_client as _av_client
        
        stock_analysis_agent = _react_agent
        av_client = _av_client
        ACTIVE_AGENT = "react"
        logger.info("React Agent initialized successfully")
    except Exception as e:
        # 回退到 LangGraph
        try:
            import backend.langgraph_service
            importlib.reload(backend.langgraph_service)
            from backend.langgraph_service import stock_analysis_agent as _lg_agent
            
            stock_analysis_agent = _lg_agent
            ACTIVE_AGENT = "langgraph"
            
            # Fallback av_client if not imported
            if 'av_client' not in locals():
                class FallbackAVClient:
                    def _request(self, *args, **kwargs): return {"error": "AV Client not available (LangGraph mode)"}
                av_client = FallbackAVClient()
        except Exception:
            stock_analysis_agent = None
            ACTIVE_AGENT = "none"
            class FallbackAVClient:
                def _request(self, *args, **kwargs): return {"error": "AV Client not available (No Agent)"}
            av_client = FallbackAVClient()
            
        logger.warning("React Agent initialization failed, fell back to %s", ACTIVE_AGENT, exc_info=e)

# Initialize on startup
initialize_analysis_agent()

@app.route('/api/analysis/quote/<symbol>', methods=['GET'])
def get_quote(symbol):
    """获取股票实时报价"""
    try:
        # 复用 analysis_agent 中的工具逻辑，或者直接调用 AV Client
        # 这里为了保持一致性，直接调用 AV Client
        params = {"function": "GLOBAL_QUOTE", "symbol": symbol.upper()}
        data = av_client._request(params)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analysis/history/<symbol>', methods=['GET'])
def get_history(symbol):
    """获取股票历史数据"""
    try:
        print(f"DEBUG: get_history called for {symbol}")
        # 默认获取 Daily
        params = {
            "function": "TIME_SERIES_DAILY", 
            "symbol": symbol.upper(),
            "outputsize": "compact" # "full" for 20 years
        }
        data = av_client._request(params)
        print(f"DEBUG: get_history data keys: {list(data.keys()) if data else 'None'}")
        if "Time Series (Daily)" in data:
            print(f"DEBUG: History data found, entries: {len(data['Time Series (Daily)'])}")
        else:
            print(f"DEBUG: Time Series (Daily) not found in data: {data}")
            
        return jsonify(data)
    except Exception as e:
        print(f"DEBUG: get_history error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/analysis/indicators/<symbol>', methods=['GET'])
def get_indicators(symbol):
    """获取股票指标数据 (SMA, RSI, MACD)"""
    try:
        # 并行获取多个指标 (此处简化为串行)
        results = {}
        
        # SMA
        sma = av_client._request({
            "function": "SMA", "symbol": symbol.upper(), "interval": "daily", "time_period": 50, "series_type": "close"
        })
        results["SMA"] = sma
        
        # RSI
        rsi = av_client._request({
            "function": "RSI", "symbol": symbol.upper(), "interval": "daily", "time_period": 14, "series_type": "close"
        })
        results["RSI"] = rsi
        
        # MACD
        macd = av_client._request({
            "function": "MACD", "symbol": symbol.upper(), "interval": "daily", "series_type": "close"
        })
        results["MACD"] = macd
        
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analysis/news/<symbol>', methods=['GET'])
def get_stock_news(symbol):
    """获取股票新闻"""
    try:
        limit = request.args.get('limit', 10)
        params = {
            "function": "NEWS_SENTIMENT",
            "tickers": symbol.upper(),
            "limit": limit
        }
        data = av_client._request(params)
        
        # Check for errors
        if "error" in data: # Check if AV client returned an error dict
             return jsonify(data), 500
        if "Error Message" in data:
             return jsonify({"error": data["Error Message"]}), 500

        feed = data.get("feed", [])
        return jsonify({"feed": feed, "sentiment_score_definition": data.get("sentiment_score_definition"), "relevance_score_definition": data.get("relevance_score_definition")})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analysis/analyze/<symbol>', methods=['POST'])
def analyze_stock_endpoint(symbol):
    """AI 股票分析"""
    try:
        if stock_analysis_agent is None:
            return jsonify({"error": "分析服务未就绪，请在设置中配置 API Key"}), 503
            
        data = request.get_json() or {}
        portfolio = data.get('portfolio')
        
        # 调用 Async Agent
        import asyncio
        result = asyncio.run(stock_analysis_agent.analyze_stock(symbol, portfolio))
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/analysis/chat/<symbol>', methods=['POST'])
def chat_stock_endpoint(symbol):
    """AI 股票对话"""
    try:
        if stock_analysis_agent is None:
             return jsonify({"error": "分析服务未就绪，请在设置中配置 API Key"}), 503
             
        data = request.get_json() or {}
        question = data.get('message')
        if not question:
            return jsonify({"error": "Message required"}), 400
            
        # 调用 Async Agent
        import asyncio
        result = asyncio.run(stock_analysis_agent.answer_question(symbol, question))
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/keys', methods=['GET'])
def get_api_keys():
    """Get API keys (unmasked for local usage)"""
    try:
        # Load from .env file directly to get latest values
        from dotenv import dotenv_values
        env_config = dotenv_values(os.path.join(platform_dir.parent, ".env"))
        
        # Support multiple variants of Alpha Vantage key
        av_key = (
            env_config.get("ALPHAVANTAGE_API_KEY") or 
            env_config.get("ALPHA_VANTAGE_API_KEY") or 
            env_config.get("ALPHAADVANTAGE_API_KEY") or 
            ""
        )
        
        keys = {
            "OPENAI_API_KEY": env_config.get("OPENAI_API_KEY", ""),
            "ANTHROPIC_API_KEY": env_config.get("ANTHROPIC_API_KEY", ""),
            "ALPHAVANTAGE_API_KEY": av_key,
            "FINANCIAL_DATASETS_API_KEY": env_config.get("FINANCIAL_DATASETS_API_KEY", "")
        }
        
        # For local app, we send keys as is so frontend can edit them properly.
        # Frontend input type="password" handles visual masking.
        return jsonify({"success": True, "keys": keys, "has_value": {k: bool(v) for k, v in keys.items()}})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/settings/keys', methods=['POST'])
def save_api_keys():
    """Save API keys to .env file"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        # Determine which .env file to use (same logic as startup)
        env_path = Path(__file__).parent.parent / ".env"
        if not env_path.exists():
            # Try root .env
            root_env = Path(__file__).parent.parent.parent / ".env"
            if root_env.exists():
                env_path = root_env
            else:
                # Try stock_hackthon .env
                hackthon_env = Path(__file__).parent.parent.parent / "stock_hackthon" / "backend" / ".env"
                if hackthon_env.exists():
                    env_path = hackthon_env
        
        # Read existing lines
        lines = []
        if env_path.exists():
            with open(env_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
        
        # Keys to manage
        keys_map = {
            "OPENAI_API_KEY": "OPENAI_API_KEY",
            "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
            "ALPHAVANTAGE_API_KEY": "ALPHAVANTAGE_API_KEY", # We'll save to this one as primary to match frontend
            "FINANCIAL_DATASETS_API_KEY": "FINANCIAL_DATASETS_API_KEY"
        }
        
        # Also ensure we clean up or sync other variants if needed, 
        # but for now let's just ensure the requested keys are saved.
        
        new_lines = []
        updated_keys = set()
        
        for line in lines:
            key_match = False
            for key, env_var in keys_map.items():
                # Check for exact match or variants for Alpha Vantage
                is_av = key == "ALPHAVANTAGE_API_KEY"
                is_target_line = (
                    line.strip().startswith(f"{env_var}=") or 
                    (is_av and (
                        line.strip().startswith("ALPHA_VANTAGE_API_KEY=") or 
                        line.strip().startswith("ALPHAADVANTAGE_API_KEY=")
                    ))
                )
                
                if is_target_line:
                    # If it's the AV key, we want to normalize to ALPHAVANTAGE_API_KEY or keep existing?
                    # Let's update the specific line found to keep file structure, 
                    # but use the value from data['ALPHAVANTAGE_API_KEY']
                    
                    val_key = key # The key in the 'data' dict
                    
                    if val_key in data:
                        # Extract the actual var name from the line to preserve it
                        actual_var_name = line.split('=')[0].strip()
                        if data[val_key]:
                            new_lines.append(f"{actual_var_name}={data[val_key]}\n")
                        else:
                            new_lines.append(f"{actual_var_name}=\n")
                        updated_keys.add(val_key)
                    else:
                        new_lines.append(line)
                    key_match = True
                    break
            
            if not key_match:
                new_lines.append(line)
        
        # Append new keys that weren't found in file
        if lines and not lines[-1].endswith('\n'):
            new_lines.append('\n')
            
        for key, env_var in keys_map.items():
            if key in data and key not in updated_keys:
                # For AV key, if not found, add standard ALPHAVANTAGE_API_KEY
                if data[key]:
                    new_lines.append(f"{env_var}={data[key]}\n")
                else:
                    new_lines.append(f"{env_var}=\n")
        
        # Write back
        if not env_path.exists():
             env_path.parent.mkdir(parents=True, exist_ok=True)

        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        # Update environment variables in current process
        for key in keys_map.keys():
            if key in data:
                # Update the specific env var used by backend
                os.environ[key] = data[key]
                # Also update variants for AV
                if key == "ALPHAVANTAGE_API_KEY":
                    os.environ["ALPHA_VANTAGE_API_KEY"] = data[key]
                    os.environ["ALPHAADVANTAGE_API_KEY"] = data[key]
        
        # Re-initialize agent with new keys
        initialize_analysis_agent()
                
        return jsonify({"success": True, "message": "API keys saved successfully"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500



if __name__ == '__main__':
    port = int(os.getenv('STRATEGY_API_PORT', '8005'))
    print(f"🚀 Starting Strategy Management API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
