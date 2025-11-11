#!/usr/bin/env python3
"""
Service Management Module
Manages MCP services and other platform services
"""

import os
import sys
import subprocess
import psutil
import time
import asyncio
import inspect
from pathlib import Path
from typing import Dict, List, Optional, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class ServiceManager:
    """Manage platform services (MCP services, APIs, etc.)"""
    
    def __init__(self, project_root: Optional[str] = None):
        if project_root is None:
            project_root = Path(__file__).parent.parent
        else:
            project_root = Path(project_root)
        
        self.project_root = project_root
        self.agent_tools_dir = project_root / "agent_tools"
    
    def check_mcp_services(self) -> Dict[str, bool]:
        """
        Check MCP services status
        
        Returns:
            Dictionary mapping service names to their running status
        """
        services_status = {}
        
        # MCP service ports
        # Note: Search and LocalPrices are replaced by Alpha Vantage MCP server
        ports = {
            'math': int(os.getenv('MATH_HTTP_PORT', '8000')),
            'trade': int(os.getenv('TRADE_HTTP_PORT', '8002'))
        }
        
        for service_name, port in ports.items():
            is_running = False
            
            try:
                # Check if port is in use
                for conn in psutil.net_connections():
                    if conn.status == psutil.CONN_LISTEN and conn.laddr.port == port:
                        is_running = True
                        break
            except (psutil.AccessDenied, PermissionError):
                # Fallback: try to connect to the port
                import socket
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.5)
                result = sock.connect_ex(('localhost', port))
                sock.close()
                is_running = (result == 0)
            
            # Also check for processes
            if not is_running:
                try:
                    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                        try:
                            cmdline = proc.info.get('cmdline', [])
                            if cmdline and any('tool_' in arg and service_name in arg for arg in cmdline):
                                is_running = True
                                break
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                except (psutil.AccessDenied, PermissionError):
                    pass
            
            services_status[service_name] = is_running
        
        return services_status
    
    def start_mcp_services(self) -> Dict:
        """
        Start MCP services
        
        Returns:
            Dictionary with service start information
        """
        # Check if already running
        status = self.check_mcp_services()
        if all(status.values()):
            return {
                "success": True,
                "message": "All MCP services are already running",
                "services": status
            }
        
        # Start MCP services
        start_script = self.agent_tools_dir / "start_mcp_services.py"
        
        if not start_script.exists():
            return {
                "success": False,
                "error": "MCP service startup script not found"
            }
        
        try:
            # Start in background
            process = subprocess.Popen(
                [sys.executable, str(start_script)],
                cwd=str(self.agent_tools_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
            
            # Wait a bit for services to start
            time.sleep(3)
            
            # Check status again
            new_status = self.check_mcp_services()
            
            return {
                "success": True,
                "message": "MCP services startup initiated",
                "process_id": process.pid,
                "services": new_status
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def stop_mcp_services(self) -> Dict:
        """
        Stop MCP services
        
        Returns:
            Dictionary with stop information
        """
        stopped = []
        
        # Find and kill MCP service processes
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and any('tool_' in arg for arg in cmdline):
                    # Check if it's an MCP service (only Math and TradeTools now)
                    if any(keyword in ' '.join(cmdline) for keyword in ['tool_math', 'tool_trade']):
                        proc.kill()
                        stopped.append(proc.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        return {
            "success": True,
            "message": f"Stopped {len(stopped)} MCP service processes",
            "stopped_pids": stopped
        }
    
    def get_all_services_status(self) -> Dict:
        """
        Get status of all platform services
        
        Returns:
            Dictionary with all service statuses
        """
        mcp_status = self.check_mcp_services()
        
        # Check API services
        api_status = {}
        api_ports = {
            'config_api': 8004,
            'strategy_api': 8005
        }
        
        for api_name, port in api_ports.items():
            is_running = False
            try:
                for conn in psutil.net_connections():
                    if conn.status == psutil.CONN_LISTEN and conn.laddr.port == port:
                        is_running = True
                        break
            except (psutil.AccessDenied, PermissionError):
                # Fallback: try to connect to the port
                import socket
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.5)
                result = sock.connect_ex(('localhost', port))
                sock.close()
                is_running = (result == 0)
            api_status[api_name] = is_running
        
        return {
            "mcp_services": mcp_status,
            "api_services": api_status,
            "all_mcp_running": all(mcp_status.values()),
            "all_apis_running": all(api_status.values())
        }
    
    def get_local_service_tools(self, service_name: str) -> List[Dict[str, Any]]:
        """
        Get tools from local MCP service with details
        
        Args:
            service_name: Service name ('math' or 'trade')
            
        Returns:
            List of tool dictionaries with name and description
        """
        tools = []
        
        if service_name == 'math':
            tools = [
                {
                    'name': 'add',
                    'description': 'Add two numbers (supports int and float)',
                    'parameters': {'a': 'float', 'b': 'float'},
                    'returns': 'float'
                },
                {
                    'name': 'multiply',
                    'description': 'Multiply two numbers (supports int and float)',
                    'parameters': {'a': 'float', 'b': 'float'},
                    'returns': 'float'
                },
                {
                    'name': 'subtract',
                    'description': 'Subtract b from a (supports int and float)',
                    'parameters': {'a': 'float', 'b': 'float'},
                    'returns': 'float'
                },
                {
                    'name': 'divide',
                    'description': 'Divide a by b (supports int and float). Returns infinity if b is zero.',
                    'parameters': {'a': 'float', 'b': 'float'},
                    'returns': 'float'
                }
            ]
        elif service_name == 'trade':
            tools = [
                {
                    'name': 'buy',
                    'description': 'Buy stock function. Updates local position files and uses Alpha Vantage API for price data when needed.',
                    'parameters': {'symbol': 'str', 'amount': 'int'},
                    'returns': 'Dict[str, Any]'
                },
                {
                    'name': 'sell',
                    'description': 'Sell stock function. Updates local position files and uses Alpha Vantage API for price data when needed.',
                    'parameters': {'symbol': 'str', 'amount': 'int'},
                    'returns': 'Dict[str, Any]'
                }
            ]
        
        return tools
    
    async def get_mcp_tools(self) -> Dict[str, Dict[str, Any]]:
        """
        Get tools from all MCP services (local and remote)
        
        Returns:
            Dictionary mapping service names to their tools
        """
        tools_by_service = {}
        
        # Get tools from local services
        local_services = ['math', 'trade']
        for service_name in local_services:
            tools_detail = self.get_local_service_tools(service_name)
            tools_by_service[service_name] = {
                'tools': [t['name'] for t in tools_detail],  # For backward compatibility
                'tools_detail': tools_detail,  # Full details
                'count': len(tools_detail),
                'type': 'local'
            }
        
        # Get tools from Alpha Vantage MCP server (remote)
        alpha_vantage_key = os.getenv("ALPHAADVANTAGE_API_KEY", "")
        print(f"🔍 Checking Alpha Vantage API key: {'SET' if alpha_vantage_key else 'NOT SET'}")
        
        if alpha_vantage_key:
            try:
                # Alpha Vantage MCP server uses standard HTTP MCP protocol
                # Reference: https://github.com/alphavantage/alpha_vantage_mcp/blob/main/examples/agent/README.md
                # We use direct HTTP requests as SSE transport doesn't work with this server
                import requests
                
                url = f"https://mcp.alphavantage.co/mcp?apikey={alpha_vantage_key}"
                
                # Step 1: Initialize MCP session
                init_payload = {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {
                            "name": "ai-trader",
                            "version": "1.0.0"
                        }
                    }
                }
                
                print(f"📡 Connecting to Alpha Vantage MCP server...")
                response = requests.post(url, json=init_payload, timeout=10, headers={"Content-Type": "application/json"})
                
                if response.status_code != 200:
                    raise Exception(f"Initialize failed with status {response.status_code}: {response.text[:200]}")
                
                init_result = response.json()
                if "error" in init_result:
                    raise Exception(f"Initialize error: {init_result['error']}")
                
                # Step 2: Get tools list
                tools_payload = {
                    "jsonrpc": "2.0",
                    "id": 2,
                    "method": "tools/list",
                    "params": {}
                }
                
                response = requests.post(url, json=tools_payload, timeout=10, headers={"Content-Type": "application/json"})
                
                if response.status_code != 200:
                    raise Exception(f"Get tools failed with status {response.status_code}: {response.text[:200]}")
                
                tools_result = response.json()
                if "error" in tools_result:
                    raise Exception(f"Get tools error: {tools_result['error']}")
                
                # Extract tools from MCP response
                mcp_tools = tools_result.get("result", {}).get("tools", [])
                print(f"✅ Got {len(mcp_tools)} tools from Alpha Vantage via HTTP")
                
                # Extract tool names and details from MCP tools
                tool_details = []
                for idx, tool in enumerate(mcp_tools):
                    try:
                        # MCP tools come as dictionaries from the HTTP response
                        tool_info = {
                            'name': tool.get('name', ''),
                            'description': tool.get('description', ''),
                            'parameters': tool.get('inputSchema', {})  # MCP uses inputSchema
                        }
                        
                        if not tool_info['name']:
                            print(f"⚠️  Tool {idx} has no name, skipping")
                            continue
                        
                        tool_details.append(tool_info)
                    except Exception as tool_err:
                        print(f"⚠️  Error processing tool {idx}: {tool_err}")
                        continue
                
                print(f"✅ Extracted {len(tool_details)} tool details from {len(mcp_tools)} tools")
                
                tools_by_service['alphavantage'] = {
                    'tools': [t['name'] for t in tool_details],  # For backward compatibility
                    'tools_detail': tool_details,  # Full details
                    'count': len(tool_details),
                    'type': 'remote'
                }
                print(f"✅ Alpha Vantage tools added: {len(tool_details)} tools")
            except Exception as e:
                # If connection fails, provide known tool categories
                print(f"⚠️ Failed to connect to Alpha Vantage MCP server: {e}")
                import traceback
                traceback.print_exc()
                
                # Provide fallback tool list with basic descriptions
                # Note: This is a limited list. The actual Alpha Vantage MCP has 120+ tools
                fallback_tools = [
                    {'name': 'TIME_SERIES_DAILY', 'description': 'Get daily time series data for a stock symbol'},
                    {'name': 'TIME_SERIES_INTRADAY', 'description': 'Get intraday time series data for a stock symbol'},
                    {'name': 'GLOBAL_QUOTE', 'description': 'Get real-time global stock quote'},
                    {'name': 'RSI', 'description': 'Calculate Relative Strength Index (RSI) technical indicator'},
                    {'name': 'MACD', 'description': 'Calculate Moving Average Convergence Divergence (MACD) indicator'},
                    {'name': 'BBANDS', 'description': 'Calculate Bollinger Bands technical indicator'},
                    {'name': 'SMA', 'description': 'Calculate Simple Moving Average'},
                    {'name': 'EMA', 'description': 'Calculate Exponential Moving Average'},
                    {'name': 'NEWS_SENTIMENT', 'description': 'Get news sentiment analysis for a stock'},
                    {'name': 'TOP_GAINERS_LOSERS', 'description': 'Get top gainers and losers in the market'},
                    {'name': 'GDP', 'description': 'Get Gross Domestic Product economic data'},
                    {'name': 'CPI', 'description': 'Get Consumer Price Index economic data'},
                    {'name': 'INFLATION', 'description': 'Get inflation rate economic data'},
                ]
                
                tools_by_service['alphavantage'] = {
                    'tools': [t['name'] for t in fallback_tools],
                    'tools_detail': fallback_tools,
                    'count': len(fallback_tools),  # Use actual count, not 120
                    'type': 'remote',
                    'note': f'⚠️ 无法连接到 Alpha Vantage MCP 服务器获取完整列表。错误: {str(e)}。显示的是示例工具列表（实际有120+个工具）。请检查网络连接和 API Key。'
                }
                print(f"⚠️  Using fallback tool list with {len(fallback_tools)} tools (actual server has 120+ tools)")
        else:
            print("⚠️ ALPHAADVANTAGE_API_KEY not set, skipping Alpha Vantage MCP service")
        
        return tools_by_service

