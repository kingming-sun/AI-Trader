#!/usr/bin/env python3
"""
Custom HTTP Server with CORS support for frontend
Replaces the default python http.server with better CORS handling
"""

import http.server
import socketserver
import os
from pathlib import Path

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler with CORS support"""
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        """Override to provide cleaner logs"""
        # Only log errors, not every request
        if self.path.startswith('/data/'):
            print(f"[DATA] {args[0]}")
        elif not self.path.startswith('/assets/'):
            print(f"[REQUEST] {self.path}")

def main():
    PORT = 8000
    
    # Change to docs directory
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print("=" * 60)
        print(f"🚀 Frontend Server Started")
        print("=" * 60)
        print(f"📍 Server running on: http://localhost:{PORT}")
        print(f"📂 Serving directory: {os.getcwd()}")
        print(f"📄 Main page: http://localhost:{PORT}/index.html")
        print("=" * 60)
        print("\n按 Ctrl+C 停止服务器\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n🛑 服务器已停止")

if __name__ == "__main__":
    main()

