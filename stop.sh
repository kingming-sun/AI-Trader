#!/bin/bash
# Stop all AI-Trader Platform services

echo "🛑 Stopping AI-Trader Platform services..."

# Stop processes from PID file
if [ -f .platform_pids ]; then
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "   Stopping process $pid..."
            kill $pid 2>/dev/null || true
        fi
    done < .platform_pids
    rm -f .platform_pids
fi

# Stop MCP services
echo "   Stopping MCP services..."
pkill -f "start_mcp_services.py" 2>/dev/null || true
pkill -f "tool_math.py" 2>/dev/null || true
pkill -f "tool_jina_search.py" 2>/dev/null || true
pkill -f "tool_trade.py" 2>/dev/null || true
pkill -f "tool_get_price_local.py" 2>/dev/null || true

# Stop API services
echo "   Stopping API services..."
pkill -f "config_api.py" 2>/dev/null || true
pkill -f "strategy_api.py" 2>/dev/null || true

# Stop frontend
echo "   Stopping frontend server..."
pkill -f "http.server 8000" 2>/dev/null || true

# Wait a bit for processes to stop
sleep 2

echo "✅ All services stopped"

