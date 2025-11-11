#!/bin/bash
# AI-Trader Platform Shutdown Script
# Stops all platform services gracefully

echo "╔════════════════════════════════════════════╗"
echo "║      🛑 AI-Trader Platform Shutdown        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to stop process by PID
stop_process() {
    local pid=$1
    local name=$2
    if ps -p $pid > /dev/null 2>&1; then
        echo "  Stopping $name (PID: $pid)..."
        kill $pid 2>/dev/null || true
        sleep 0.5
        # Force kill if still running
        if ps -p $pid > /dev/null 2>&1; then
            kill -9 $pid 2>/dev/null || true
        fi
        echo -e "  ${GREEN}✓${NC} $name stopped"
    fi
}

echo "📋 Stopping services..."
echo ""

# Stop services from PID file
if [ -f .platform_pids ]; then
    echo "Reading saved PIDs..."
    PIDS=$(cat .platform_pids)
    SERVICE_NAMES=("MCP Services" "Config API" "Strategy API" "Frontend Server")
    INDEX=0
    for pid in $PIDS; do
        stop_process $pid "${SERVICE_NAMES[$INDEX]}"
        INDEX=$((INDEX + 1))
    done
    rm .platform_pids
    echo ""
fi

# Clean up any remaining processes
echo "🧹 Cleaning up remaining processes..."

# Stop MCP services
# Note: Search and LocalPrices are replaced by Alpha Vantage MCP server
pkill -f "start_mcp_services.py" 2>/dev/null || true
pkill -f "tool_math.py" 2>/dev/null || true
pkill -f "tool_trade.py" 2>/dev/null || true
# Legacy services (no longer used, but kept for cleanup)
pkill -f "tool_jina_search.py" 2>/dev/null || true
pkill -f "tool_get_price_local.py" 2>/dev/null || true

# Stop API services
pkill -f "config_api.py" 2>/dev/null || true
pkill -f "strategy_api.py" 2>/dev/null || true

# Stop frontend (both possible ports)
pkill -f "http.server 8000" 2>/dev/null || true
pkill -f "http.server 8080" 2>/dev/null || true

# Stop any main.py processes
pkill -f "main.py" 2>/dev/null || true

echo -e "${GREEN}✓${NC} Process cleanup complete"
echo ""

# Check port status
echo "🔍 Verifying port status..."
PORTS_FREE=true
for port in 8000 8001 8002 8003 8004 8005 8080; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠${NC}  Port $port is still in use"
        PORTS_FREE=false
    fi
done

if [ "$PORTS_FREE" = true ]; then
    echo -e "${GREEN}✅ All ports are free${NC}"
else
    echo -e "${YELLOW}⚠️  Some ports are still in use. You may need to manually stop those services.${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║    ✅ Platform Shutdown Complete           ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "To restart the platform, run: ./start.sh"
echo ""

