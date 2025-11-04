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
from pathlib import Path
from typing import Dict, List, Optional

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
        ports = {
            'math': int(os.getenv('MATH_HTTP_PORT', '8000')),
            'search': int(os.getenv('SEARCH_HTTP_PORT', '8001')),
            'trade': int(os.getenv('TRADE_HTTP_PORT', '8002')),
            'price': int(os.getenv('GETPRICE_HTTP_PORT', '8003'))
        }
        
        for service_name, port in ports.items():
            is_running = False
            
            # Check if port is in use
            for conn in psutil.net_connections():
                if conn.status == psutil.CONN_LISTEN and conn.laddr.port == port:
                    is_running = True
                    break
            
            # Also check for processes
            if not is_running:
                for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                    try:
                        cmdline = proc.info.get('cmdline', [])
                        if cmdline and any('tool_' in arg and service_name in arg for arg in cmdline):
                            is_running = True
                            break
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
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
                    # Check if it's an MCP service
                    if any(keyword in ' '.join(cmdline) for keyword in ['tool_math', 'tool_jina_search', 'tool_trade', 'tool_get_price']):
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
            for conn in psutil.net_connections():
                if conn.status == psutil.CONN_LISTEN and conn.laddr.port == port:
                    is_running = True
                    break
            api_status[api_name] = is_running
        
        return {
            "mcp_services": mcp_status,
            "api_services": api_status,
            "all_mcp_running": all(mcp_status.values()),
            "all_apis_running": all(api_status.values())
        }

