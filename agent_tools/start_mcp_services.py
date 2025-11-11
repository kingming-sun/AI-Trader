#!/usr/bin/env python3
"""
MCP Service Startup Script (Python Version)
Start local MCP services: Math, TradeTools
Note: Search and LocalPrices are replaced by Alpha Vantage MCP server
"""

import os
import sys
import time
import signal
import subprocess
import threading
from pathlib import Path

class MCPServiceManager:
    def __init__(self):
        self.services = {}
        self.running = True
        
        # Set default ports
        # Note: Search and LocalPrices are now replaced by Alpha Vantage MCP server
        self.ports = {
            'math': int(os.getenv('MATH_HTTP_PORT', '8000')),
            'trade': int(os.getenv('TRADE_HTTP_PORT', '8002'))
        }
        
        # Service configurations
        # Only Math and TradeTools are kept as local services
        # Search and LocalPrices are replaced by Alpha Vantage MCP server
        self.service_configs = {
            'math': {
                'script': 'tool_math.py',
                'name': 'Math',
                'port': self.ports['math']
            },
            'trade': {
                'script': 'tool_trade.py',
                'name': 'TradeTools',
                'port': self.ports['trade']
            }
        }
        
        # Create logs directory
        self.log_dir = Path('../logs')
        self.log_dir.mkdir(exist_ok=True)
        
        # Set signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def signal_handler(self, signum, frame):
        """Handle interrupt signals"""
        print("\n🛑 Received stop signal, shutting down all services...")
        self.stop_all_services()
        sys.exit(0)
    
    def start_service(self, service_id, config):
        """Start a single service"""
        script_path = config['script']
        service_name = config['name']
        port = config['port']
        
        if not Path(script_path).exists():
            print(f"❌ Script file not found: {script_path}")
            return False
        
        try:
            # Start service process
            log_file = self.log_dir / f"{service_id}.log"
            
            # Set RUNTIME_ENV_PATH environment variable for MCP services
            # This ensures MCP services can access runtime_env.json
            env = os.environ.copy()
            project_root = Path(__file__).parent.parent
            runtime_env_path = project_root / "runtime_env.json"
            env["RUNTIME_ENV_PATH"] = str(runtime_env_path)
            
            with open(log_file, 'w') as f:
                process = subprocess.Popen(
                    [sys.executable, script_path],
                    stdout=f,
                    stderr=subprocess.STDOUT,
                    cwd=os.getcwd(),
                    env=env
                )
            
            self.services[service_id] = {
                'process': process,
                'name': service_name,
                'port': port,
                'log_file': log_file
            }
            
            print(f"✅ {service_name} service started (PID: {process.pid}, Port: {port})")
            return True
            
        except Exception as e:
            print(f"❌ Failed to start {service_name} service: {e}")
            return False
    
    def check_service_health(self, service_id):
        """Check service health status"""
        if service_id not in self.services:
            return False
        
        service = self.services[service_id]
        process = service['process']
        port = service['port']
        
        # Check if process is still running
        if process.poll() is not None:
            return False
        
        # Check if port is responding (simple check)
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('localhost', port))
            sock.close()
            return result == 0
        except:
            return False
    
    def start_all_services(self):
        """Start all services"""
        print("🚀 Starting MCP services...")
        print("=" * 50)
        
        print(f"📊 Port configuration:")
        for service_id, config in self.service_configs.items():
            print(f"  - {config['name']}: {config['port']}")
        
        print("\n🔄 Starting services...")
        
        # Start all services
        for service_id, config in self.service_configs.items():
            self.start_service(service_id, config)
        
        # Wait for services to start
        print("\n⏳ Waiting for services to start...")
        time.sleep(3)
        
        # Check service status
        print("\n🔍 Checking service status...")
        self.check_all_services()
        
        print("\n🎉 All MCP services started!")
        self.print_service_info()
        
        # Keep running
        self.keep_alive()
    
    def check_all_services(self):
        """Check all service status"""
        for service_id, service in self.services.items():
            if self.check_service_health(service_id):
                print(f"✅ {service['name']} service running normally")
            else:
                print(f"❌ {service['name']} service failed to start")
                print(f"   Please check logs: {service['log_file']}")
    
    def print_service_info(self):
        """Print service information"""
        print("\n📋 Service information:")
        for service_id, service in self.services.items():
            print(f"  - {service['name']}: http://localhost:{service['port']} (PID: {service['process'].pid})")
        
        print(f"\n📁 Log files location: {self.log_dir.absolute()}")
        print("\n🛑 Press Ctrl+C to stop all services")
    
    def keep_alive(self):
        """Keep services running"""
        try:
            while self.running:
                time.sleep(1)
                
                # Check service status
                for service_id, service in self.services.items():
                    if service['process'].poll() is not None:
                        print(f"\n⚠️  {service['name']} service stopped unexpectedly")
                        self.running = False
                        break
                        
        except KeyboardInterrupt:
            pass
        finally:
            self.stop_all_services()
    
    def stop_all_services(self):
        """Stop all services"""
        print("\n🛑 Stopping all services...")
        
        for service_id, service in self.services.items():
            try:
                service['process'].terminate()
                service['process'].wait(timeout=5)
                print(f"✅ {service['name']} service stopped")
            except subprocess.TimeoutExpired:
                service['process'].kill()
                print(f"🔨 {service['name']} service force stopped")
            except Exception as e:
                print(f"❌ Error stopping {service['name']} service: {e}")
        
        print("✅ All services stopped")
    
    def status(self):
        """Display service status"""
        print("📊 MCP Service Status Check")
        print("=" * 30)
        
        for service_id, config in self.service_configs.items():
            if service_id in self.services:
                service = self.services[service_id]
                if self.check_service_health(service_id):
                    print(f"✅ {config['name']} service running normally (Port: {config['port']})")
                else:
                    print(f"❌ {config['name']} service abnormal (Port: {config['port']})")
            else:
                print(f"❌ {config['name']} service not started (Port: {config['port']})")

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == 'status':
        # Status check mode
        manager = MCPServiceManager()
        manager.status()
    else:
        # Startup mode
        manager = MCPServiceManager()
        manager.start_all_services()

if __name__ == "__main__":
    main()
