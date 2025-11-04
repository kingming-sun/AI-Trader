#!/bin/bash
# Stop all platform services

echo "🛑 Stopping AI-Trader Platform services..."

# Read PIDs from file
if [ -f .platform_pids ]; then
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "Stopping process $pid..."
            kill $pid 2>/dev/null || true
        fi
    done < .platform_pids
    rm .platform_pids
fi

# Also stop MCP services
pkill -f "start_mcp_services.py" || true
pkill -f "tool_math.py" || true
pkill -f "tool_jina_search.py" || true
pkill -f "tool_trade.py" || true
pkill -f "tool_get_price_local.py" || true

# Stop API services
pkill -f "config_api.py" || true
pkill -f "strategy_api.py" || true

# Stop frontend
pkill -f "http.server 8000" || true

echo "✅ All services stopped"

