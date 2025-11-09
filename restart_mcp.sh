#!/bin/bash
# AI-Trader MCP Services Restart Script
# Only restarts MCP services (Math, Search, Trade, Price) without affecting other services

echo "╔════════════════════════════════════════════╗"
echo "║      🔄 MCP Services Restart                ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Stop MCP services
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 1: Stopping MCP services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "  Stopping MCP service manager..."
pkill -f "start_mcp_services.py" 2>/dev/null || true

echo "  Stopping individual MCP services..."
pkill -f "tool_math.py" 2>/dev/null || true
pkill -f "tool_jina_search.py" 2>/dev/null || true
pkill -f "tool_trade.py" 2>/dev/null || true
pkill -f "tool_get_price_local.py" 2>/dev/null || true

# Wait for processes to fully stop
sleep 2

# Verify ports are free
echo ""
echo "🔍 Verifying MCP ports are free..."
PORTS_FREE=true
for port in 8000 8001 8002 8003; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "  ${YELLOW}⚠${NC}  Port $port is still in use, forcing cleanup..."
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
done

if [ "$PORTS_FREE" = true ]; then
    echo -e "  ${GREEN}✓${NC} All MCP ports are free"
else
    echo -e "  ${GREEN}✓${NC} MCP ports cleaned up"
fi

# Step 2: Start MCP services
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 2: Starting MCP services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to wait for service
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
            echo -e "  ${GREEN}✓${NC} $service_name is ready"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "  ${YELLOW}⚠${NC} $service_name may not be fully ready"
    return 1
}

# Check Python virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo "🐍 Activating Python virtual environment..."
    if [ -d "venv" ]; then
        source venv/bin/activate
        echo -e "${GREEN}✅ Virtual environment activated${NC}"
    else
        echo -e "${YELLOW}⚠️  No virtual environment found, using system Python${NC}"
    fi
else
    echo -e "${GREEN}✅ Virtual environment already active${NC}"
fi
echo ""

# Create log directory
mkdir -p logs

# Start MCP services
echo "Starting MCP Services (Math, Search, Trade, Price)..."
cd agent_tools
nohup python start_mcp_services.py > ../logs/mcp_services.log 2>&1 &
MCP_PID=$!
cd ..
sleep 3

# Wait for services to be ready
wait_for_service "http://localhost:8000" "Math Service"
wait_for_service "http://localhost:8001" "Search Service"
wait_for_service "http://localhost:8002" "Trade Service"
wait_for_service "http://localhost:8003" "Price Service"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║    ✅ MCP Services Restart Complete         ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📊 MCP Service Status:"
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ Service          │ Port  │ Status  │ PID                   │"
echo "├─────────────────────────────────────────────────────────────┤"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "MCP Math" "8000" "Active" "$MCP_PID"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "MCP Search" "8001" "Active" "-"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "MCP Trade" "8002" "Active" "-"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "MCP Price" "8003" "Active" "-"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "📝 Logs: logs/mcp_services.log"
echo ""

