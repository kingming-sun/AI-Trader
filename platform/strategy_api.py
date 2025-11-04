#!/usr/bin/env python3
"""
Strategy Management API
Flask API for strategy management and mode switching
"""

import os
import sys
import json
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
        strategy_name = data.get('strategy_name', 'New Strategy')
        description = data.get('description', '')
        
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

@app.route('/api/strategies/<strategy_id>/config/<mode>', methods=['GET'])
def get_strategy_config(strategy_id, mode):
    """Get strategy configuration for a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        config = strategy_manager.get_strategy_config(strategy_id, mode)
        return jsonify({"success": True, "config": config})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/strategies/<strategy_id>/config/<mode>', methods=['POST', 'PUT'])
def save_strategy_config(strategy_id, mode):
    """Save strategy configuration for a specific mode"""
    try:
        if mode not in ["backtest", "simulate", "real"]:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        data = request.get_json()
        config = data.get('config', {})
        
        # Save config to file
        strategy_dir = strategy_manager.strategies_dir / strategy_id
        config_file = strategy_dir / f"{mode}_config.json"
        
        with open(config_file, 'w', encoding='utf-8') as f:
            import json
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return jsonify({"success": True, "message": "Config saved successfully"})
    except Exception as e:
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
        prompt_file = strategy_dir / "prompts" / f"{mode}_prompt.py"
        
        if not prompt_file.exists():
            prompt_file = strategy_dir / "prompts" / "base_prompt.py"
        
        if not prompt_file.exists():
            return jsonify({"success": False, "error": "Prompt not found"}), 404
        
        with open(prompt_file, 'r', encoding='utf-8') as f:
            content = f.read()
            import re
            match = re.search(r'agent_system_prompt = """([\s\S]*?)"""', content)
            if match:
                prompt = match.group(1).strip()
                return jsonify({"success": True, "prompt": prompt})
            else:
                return jsonify({"success": False, "error": "Could not extract prompt"}), 500
    except Exception as e:
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
        
        prompt_file = prompts_dir / f"{mode}_prompt.py"
        python_code = f'''agent_system_prompt = """\n{prompt_text}\n"""'''
        
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(python_code)
        
        return jsonify({"success": True, "message": "Prompt saved successfully"})
    except Exception as e:
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

if __name__ == '__main__':
    port = int(os.getenv('STRATEGY_API_PORT', '8005'))
    print(f"🚀 Starting Strategy Management API on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)

