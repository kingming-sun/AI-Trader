#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Startup script for Render deployment
Starts all services in a single process using threading
"""

import os
import sys
import time
import threading
import signal
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get port from Render (defaults to 8080 for frontend)
PORT = int(os.getenv('PORT', '8080'))

def start_mcp_services():
    """Start MCP services in background"""
    try:
        import subprocess
        os.chdir('agent_tools')
        process = subprocess.Popen(
            [sys.executable, 'start_mcp_services.py'],
            stdout=open('../logs/mcp_services.log', 'w'),
            stderr=subprocess.STDOUT
        )
        os.chdir('..')
        print(f"✅ MCP services started (PID: {process.pid})")
        return process
    except Exception as e:
        print(f"⚠️  Failed to start MCP services: {e}")
        return None

def start_config_api():
    """Start Config API in background thread"""
    def run():
        try:
            import config_api
            config_api.app.run(host='0.0.0.0', port=8004, debug=False)
        except Exception as e:
            print(f"❌ Config API error: {e}")
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    time.sleep(2)
    print("✅ Config API started on port 8004")
    return thread

def start_strategy_api():
    """Start Strategy API in background thread"""
    def run():
        try:
            import platform.strategy_api as strategy_api
            strategy_api.app.run(host='0.0.0.0', port=8005, debug=False)
        except Exception as e:
            print(f"❌ Strategy API error: {e}")
    
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    time.sleep(2)
    print("✅ Strategy API started on port 8005")
    return thread

def start_frontend_server():
    """Start frontend HTTP server with CORS support"""
    import http.server
    import socketserver
    from pathlib import Path
    
    class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
        """HTTP Request Handler with CORS support"""
        
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(Path(__file__).parent / 'docs'), **kwargs)
        
        def end_headers(self):
            # Add CORS headers
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            super().end_headers()
        
        def do_OPTIONS(self):
            """Handle preflight requests"""
            self.send_response(200)
            self.end_headers()
        
        def do_GET(self):
            """Handle GET requests with health check and API proxy"""
            if self.path == '/health':
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok","service":"ai-trader"}')
                return
            
            # API proxy for Render deployment
            if self.path.startswith('/api-proxy/'):
                self.proxy_api_request()
                return
            
            super().do_GET()
        
        def do_POST(self):
            """Handle POST requests with API proxy"""
            if self.path.startswith('/api-proxy/'):
                self.proxy_api_request()
                return
            super().do_POST()
        
        def proxy_api_request(self):
            """Proxy API requests to internal services"""
            import urllib.request
            import urllib.parse
            
            # Extract target service and path
            # Example: /api-proxy/strategy/api/strategies -> service='strategy', path='api/strategies'
            path_parts = self.path.split('/api-proxy/')
            if len(path_parts) < 2:
                self.send_error(404)
                return
            
            remaining_path = path_parts[1]
            parts = remaining_path.split('/', 1)
            target_service = parts[0]
            api_path = parts[1] if len(parts) > 1 else ''
            
            # Map service names to ports
            service_ports = {
                'strategy': 8005,
                'config': 8004
            }
            
            if target_service not in service_ports:
                self.send_error(404, f"Unknown service: {target_service}")
                return
            
            port = service_ports[target_service]
            # Build target URL - if api_path starts with 'api/', use it directly, otherwise add 'api/'
            if api_path.startswith('api/'):
                target_url = f'http://localhost:{port}/{api_path}'
            else:
                target_url = f'http://localhost:{port}/api/{api_path}'
            
            # Read request body if present
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = None
            if content_length > 0:
                request_body = self.rfile.read(content_length)
            
            # Prepare headers (remove host and connection)
            proxy_headers = {}
            for header, value in self.headers.items():
                header_lower = header.lower()
                if header_lower not in ['host', 'connection', 'content-length']:
                    proxy_headers[header] = value
            
            if content_length > 0:
                proxy_headers['Content-Length'] = str(content_length)
            
            try:
                # Create proxy request
                req = urllib.request.Request(
                    target_url,
                    data=request_body,
                    headers=proxy_headers,
                    method=self.command
                )
                
                # Make request
                with urllib.request.urlopen(req, timeout=10) as response:
                    # Copy response
                    self.send_response(response.status)
                    # Copy response headers
                    for header, value in response.headers.items():
                        header_lower = header.lower()
                        if header_lower not in ['connection', 'transfer-encoding', 'content-encoding']:
                            self.send_header(header, value)
                    self.end_headers()
                    # Copy response body
                    self.wfile.write(response.read())
            except urllib.error.HTTPError as e:
                # Handle HTTP errors
                self.send_response(e.code)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_msg = f'{{"error": "Proxy error: {e.reason}", "service": "{target_service}"}}'
                self.wfile.write(error_msg.encode())
            except Exception as e:
                print(f"Proxy error for {target_service}: {e}")
                self.send_error(502, f"Proxy error: {str(e)}")
        
        def log_message(self, format, *args):
            # Suppress verbose logging
            pass
    
    server = socketserver.TCPServer(("0.0.0.0", PORT), CORSRequestHandler)
    print(f"✅ Frontend server started on port {PORT}")
    return server

def main():
    """Main startup function"""
    print("🚀 Starting AI-Trader Platform...")
    print(f"📌 Using PORT: {PORT}")
    
    # Create necessary directories
    Path('logs').mkdir(exist_ok=True)
    Path('data').mkdir(exist_ok=True)
    Path('configs').mkdir(exist_ok=True)
    
    # Start MCP services
    print("1️⃣  Starting MCP services...")
    mcp_process = start_mcp_services()
    if mcp_process:
        time.sleep(5)  # Give MCP services more time to start
    else:
        print("⚠️  MCP services may not be available")
    
    # Start APIs
    print("2️⃣  Starting API services...")
    config_api_thread = start_config_api()
    strategy_api_thread = start_strategy_api()
    time.sleep(2)
    
    # Start frontend (main service)
    print("3️⃣  Starting frontend server...")
    frontend_server = start_frontend_server()
    
    print("\n" + "="*60)
    print("✅ All services started successfully!")
    print("="*60)
    print(f"🌐 Frontend: http://0.0.0.0:{PORT}")
    print(f"📊 Config API: http://0.0.0.0:8004")
    print(f"📈 Strategy API: http://0.0.0.0:8005")
    print("="*60 + "\n")
    
    # Handle shutdown
    def signal_handler(sig, frame):
        print("\n🛑 Shutting down...")
        if mcp_process:
            mcp_process.terminate()
        frontend_server.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Run frontend server (blocking)
        frontend_server.serve_forever()
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == '__main__':
    main()

