#!/bin/bash
# AI-Trader Platform Startup Script
# Consolidated script to start all required services

set -e

echo "╔════════════════════════════════════════════╗"
echo "║      🚀 AI-Trader Platform Launcher        ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Port $port is already in use${NC}"
        echo "   Please stop the service using this port or run './stop.sh'"
        return 1
    fi
    return 0
}

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

# Check required ports
echo "📍 Checking port availability..."
PORTS_OK=true
# Note: Ports 8001 and 8003 are no longer needed (replaced by Alpha Vantage MCP)
for port in 8000 8002 8004 8005 8080; do
    if ! check_port $port; then
        PORTS_OK=false
    fi
done

if [ "$PORTS_OK" = false ]; then
    echo ""
    echo -e "${RED}Cannot start platform: Some ports are already in use.${NC}"
    echo "Run './stop.sh' to stop existing services, or check what's using the ports."
    exit 1
fi

echo -e "${GREEN}✅ All required ports are available${NC}"
echo ""

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

# Start services
echo "🚀 Starting services..."
echo ""

# Step 1: MCP Services
echo "1️⃣  Starting MCP Services (Math, Trade)..."
echo "   Note: Search and Price replaced by Alpha Vantage MCP server"
cd agent_tools
nohup python start_mcp_services.py > ../logs/mcp_services.log 2>&1 &
MCP_PID=$!
cd ..
sleep 3
wait_for_service "http://localhost:8000" "Math Service"
wait_for_service "http://localhost:8002" "Trade Service"
echo ""

# Step 2: Config API
echo "2️⃣  Starting Configuration API (port 8004)..."
nohup python config_api.py > logs/config_api.log 2>&1 &
CONFIG_API_PID=$!
sleep 2
wait_for_service "http://localhost:8004/api/config" "Config API"
echo ""

# Step 3: Strategy API
echo "3️⃣  Starting Strategy Management API (port 8005)..."
nohup python platform/strategy_api.py > logs/strategy_api.log 2>&1 &
STRATEGY_API_PID=$!
sleep 2
wait_for_service "http://localhost:8005/api/strategies" "Strategy API"
echo ""

# Step 4: Frontend Server
echo "4️⃣  Starting Web Frontend Server (port 8080)..."
cd docs
nohup python3 -m http.server 8080 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 1
wait_for_service "http://localhost:8080" "Frontend Server"
echo ""

# Save PIDs for cleanup
echo "$MCP_PID $CONFIG_API_PID $STRATEGY_API_PID $FRONTEND_PID" > .platform_pids

# Display success information
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         🎉 AI-Trader Platform Successfully Started!        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Service Status:"
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ Service          │ Port  │ Status  │ PID                   │"
echo "├─────────────────────────────────────────────────────────────┤"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "MCP Math" "8000" "Active" "$MCP_PID"
printf "│ %-16s │ %-5s │ ${CYAN}%-7s${NC} │ %-21s │\n" "Alpha Vantage" "Remote" "Active" "MCP Server"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "MCP Trade" "8002" "Active" "-"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "Config API" "8004" "Active" "$CONFIG_API_PID"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "Strategy API" "8005" "Active" "$STRATEGY_API_PID"
printf "│ %-16s │ %-5s │ ${GREEN}%-7s${NC} │ %-21s │\n" "Web Frontend" "8080" "Active" "$FRONTEND_PID"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "🌐 Access Points:"
echo "  ${BLUE}Main Platform:${NC}     http://localhost:8080/home.html"
echo "  ${BLUE}Strategy Manager:${NC}  http://localhost:8080/strategies.html"
echo "  ${BLUE}Service Status:${NC}    http://localhost:8080/services.html"
echo ""
echo "📝 Logs:"
echo "  All service logs are saved in the 'logs/' directory"
echo ""
echo "🛑 To stop all services:"
echo "  Run: ${YELLOW}./stop.sh${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

