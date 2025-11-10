#!/usr/bin/env python3
"""
Strategy Management API
Flask API for strategy management and mode switching
"""

import os
import sys
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

# Add platform directory to path
platform_dir = Path(__file__).parent
sys.path.insert(0, str(platform_dir))

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
        return jsonify({"success": True, "status": status})
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
        
        data_file = project_root / "data" / "merged.jsonl"
        if not data_file.exists():
            return jsonify({
                "success": True,
                "available": False,
                "message": "本地没有可用的价格数据文件"
            })
        
        min_date, max_date = get_data_date_range(data_file)
        
        if min_date and max_date:
            return jsonify({
                "success": True,
                "available": True,
                "start_date": min_date,
                "end_date": max_date,
                "message": f"数据范围: {min_date} 到 {max_date}"
            })
        else:
            return jsonify({
                "success": True,
                "available": False,
                "message": "本地没有可用的价格数据"
            })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/restart-service', methods=['POST'])
def restart_service():
    """Restart the main service to apply new configuration"""
    try:
        data = request.get_json()
        strategy_id = data.get('strategy_id')
        
        # TODO: Implement service restart logic
        # This would typically:
        # 1. Stop the current main.py process if running
        # 2. Start a new main.py process with updated config
        
        import subprocess
        import sys
        
        # For now, return a message that restart needs to be done manually
        return jsonify({
            "success": True,
            "message": "Please restart the service manually to apply configuration changes",
            "manual_command": f"python main.py --strategy {strategy_id}" if strategy_id else "python main.py"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('STRATEGY_API_PORT', '8005'))
    print(f"🚀 Starting Strategy Management API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)

