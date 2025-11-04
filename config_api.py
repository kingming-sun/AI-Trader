#!/usr/bin/env python3
"""
Configuration API Server
Simple Flask backend to handle config file read/write operations
"""

import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Project root directory
PROJECT_ROOT = Path(__file__).parent
CONFIG_PATH = PROJECT_ROOT / "configs" / "default_config.json"
PROMPT_PATH = PROJECT_ROOT / "prompts" / "agent_prompt.py"


@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration"""
    try:
        if not CONFIG_PATH.exists():
            return jsonify({"error": "Config file not found"}), 404
        
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        return jsonify(config)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/config', methods=['POST', 'PUT'])
def save_config():
    """Save configuration"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate JSON structure
        required_keys = ['date_range', 'models', 'agent_config']
        for key in required_keys:
            if key not in data:
                return jsonify({"error": f"Missing required key: {key}"}), 400
        
        # Backup existing config
        if CONFIG_PATH.exists():
            backup_path = CONFIG_PATH.with_suffix('.json.backup')
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                backup_data = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(backup_data)
        
        # Write new config
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return jsonify({"success": True, "message": "Configuration saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/prompt', methods=['GET'])
def get_prompt():
    """Get current prompt"""
    try:
        if not PROMPT_PATH.exists():
            return jsonify({"error": "Prompt file not found"}), 404
        
        with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract prompt from Python file
        import re
        match = re.search(r'agent_system_prompt = """([\s\S]*?)"""', content)
        if match:
            prompt = match.group(1).strip()
            return jsonify({"prompt": prompt})
        else:
            return jsonify({"error": "Could not extract prompt from file"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/prompt', methods=['POST', 'PUT'])
def save_prompt():
    """Save prompt"""
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({"error": "No prompt data provided"}), 400
        
        prompt_text = data['prompt'].strip()
        
        # Backup existing prompt
        if PROMPT_PATH.exists():
            backup_path = PROMPT_PATH.with_suffix('.py.backup')
            with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
                backup_data = f.read()
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(backup_data)
        
        # Read existing file to preserve other code
        if PROMPT_PATH.exists():
            with open(PROMPT_PATH, 'r', encoding='utf-8') as f:
                file_content = f.read()
            
            # Replace prompt section
            import re
            new_content = re.sub(
                r'agent_system_prompt = """[\s\S]*?"""',
                f'agent_system_prompt = """\n{prompt_text}\n"""',
                file_content,
                flags=re.DOTALL
            )
            
            if new_content == file_content:
                # If replacement didn't work, try a different pattern
                new_content = re.sub(
                    r'agent_system_prompt = """([\s\S]*?)"""',
                    f'agent_system_prompt = """\n{prompt_text}\n"""',
                    file_content,
                    flags=re.DOTALL
                )
        else:
            # Create new file if it doesn't exist
            new_content = f'''import os
from dotenv import load_dotenv
load_dotenv()
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import sys
import os

# Add project root directory to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
from tools.price_tools import get_yesterday_date, get_open_prices, get_yesterday_open_and_close_price, get_today_init_position, get_yesterday_profit
from tools.general_tools import get_config_value

all_nasdaq_100_symbols = [
    "NVDA", "MSFT", "AAPL", "GOOG", "GOOGL", "AMZN", "META", "AVGO", "TSLA",
    "NFLX", "PLTR", "COST", "ASML", "AMD", "CSCO", "AZN", "TMUS", "MU", "LIN",
    "PEP", "SHOP", "APP", "INTU", "AMAT", "LRCX", "PDD", "QCOM", "ARM", "INTC",
    "BKNG", "AMGN", "TXN", "ISRG", "GILD", "KLAC", "PANW", "ADBE", "HON",
    "CRWD", "CEG", "ADI", "ADP", "DASH", "CMCSA", "VRTX", "MELI", "SBUX",
    "CDNS", "ORLY", "SNPS", "MSTR", "MDLZ", "ABNB", "MRVL", "CTAS", "TRI",
    "MAR", "MNST", "CSX", "ADSK", "PYPL", "FTNT", "AEP", "WDAY", "REGN", "ROP",
    "NXPI", "DDOG", "AXON", "ROST", "IDXX", "EA", "PCAR", "FAST", "EXC", "TTWO",
    "XEL", "ZS", "PAYX", "WBD", "BKR", "CPRT", "CCEP", "FANG", "TEAM", "CHTR",
    "KDP", "MCHP", "GEHC", "VRSK", "CTSH", "CSGP", "KHC", "ODFL", "DXCM", "TTD",
    "ON", "BIIB", "LULU", "CDW", "GFS"
]

STOP_SIGNAL = "<FINISH_SIGNAL>"

agent_system_prompt = """
{prompt_text}
"""

def get_agent_system_prompt(today_date: str, signature: str) -> str:
    print(f"signature: {{signature}}")
    print(f"today_date: {{today_date}}")
    # Get yesterday's buy and sell prices
    yesterday_buy_prices, yesterday_sell_prices = get_yesterday_open_and_close_price(today_date, all_nasdaq_100_symbols)
    today_buy_price = get_open_prices(today_date, all_nasdaq_100_symbols)
    today_init_position = get_today_init_position(today_date, signature)
    yesterday_profit = get_yesterday_profit(today_date, yesterday_buy_prices, yesterday_sell_prices, today_init_position)
    return agent_system_prompt.format(
        date=today_date, 
        positions=today_init_position, 
        STOP_SIGNAL=STOP_SIGNAL,
        yesterday_close_price=yesterday_sell_prices,
        today_buy_price=today_buy_price,
        yesterday_profit=yesterday_profit
    )


if __name__ == "__main__":
    today_date = get_config_value("TODAY_DATE")
    signature = get_config_value("SIGNATURE")
    if signature is None:
        raise ValueError("SIGNATURE environment variable is not set")
    print(get_agent_system_prompt(today_date, signature))
'''
        
        # Write updated file
        PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(PROMPT_PATH, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        return jsonify({"success": True, "message": "Prompt saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/restart-main', methods=['POST'])
def restart_main():
    """Restart main.py process"""
    try:
        import subprocess
        import psutil
        import os
        
        # Find and kill existing main.py process
        killed_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and 'main.py' in ' '.join(cmdline):
                    # Don't kill this API server
                    if 'config_api.py' not in ' '.join(cmdline):
                        proc.kill()
                        killed_processes.append(proc.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # Wait a bit for processes to terminate
        import time
        time.sleep(1)
        
        # Start main.py in background
        project_root = Path(__file__).parent
        main_script = project_root / "main.py"
        
        if not main_script.exists():
            return jsonify({"error": "main.py not found"}), 404
        
        # Start in background (detached)
        if os.name == 'nt':  # Windows
            subprocess.Popen(
                ['python', str(main_script)],
                cwd=str(project_root),
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
            )
        else:  # Unix/Linux/Mac
            subprocess.Popen(
                ['python3', str(main_script)],
                cwd=str(project_root),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
        
        return jsonify({
            "success": True,
            "message": "main.py restart initiated",
            "killed_processes": killed_processes
        })
    except ImportError:
        # Fallback if psutil is not available
        return jsonify({
            "error": "psutil not installed. Please install: pip install psutil"
        }), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/main-status', methods=['GET'])
def main_status():
    """Check if main.py is running"""
    try:
        import psutil
        
        is_running = False
        processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'status']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and 'main.py' in ' '.join(cmdline):
                    if 'config_api.py' not in ' '.join(cmdline):
                        is_running = True
                        processes.append({
                            'pid': proc.info['pid'],
                            'status': proc.info['status'],
                            'cmdline': ' '.join(cmdline[:3])  # First 3 args
                        })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        return jsonify({
            "is_running": is_running,
            "processes": processes
        })
    except ImportError:
        return jsonify({
            "is_running": False,
            "error": "psutil not installed"
        }), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "config-api"})


if __name__ == '__main__':
    import sys
    
    # Default port
    port = int(os.getenv('CONFIG_API_PORT', 8004))
    
    print(f"🚀 Starting Configuration API Server on port {port}")
    print(f"📁 Config path: {CONFIG_PATH}")
    print(f"📝 Prompt path: {PROMPT_PATH}")
    print(f"🌐 API endpoints:")
    print(f"   GET  /api/config  - Get configuration")
    print(f"   POST /api/config  - Save configuration")
    print(f"   GET  /api/prompt  - Get prompt")
    print(f"   POST /api/prompt  - Save prompt")
    print(f"\n✅ Server ready at http://localhost:{port}")
    
    app.run(host='0.0.0.0', port=port, debug=False)

