#!/bin/bash
# AI-Trader Platform - One-Click Startup Script
# Starts all required services: MCP, Config API, Strategy API, Frontend

set -e

echo "🚀 Starting AI-Trader Platform..."
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python3."
    exit 1
fi

# Activate virtual environment if exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create logs directory
mkdir -p logs

# Step 1: Start MCP Services
echo -e "${GREEN}🔧 [1/4] Starting MCP Services...${NC}"
cd agent_tools
python start_mcp_services.py > ../logs/mcp_services.log 2>&1 &
MCP_PID=$!
cd ..
echo "   ⏳ Waiting for MCP services to start..."
sleep 5
if ps -p $MCP_PID > /dev/null 2>&1; then
    echo "   ✅ MCP Services started (PID: $MCP_PID)"
else
    echo "   ⚠️  MCP Services may have issues, check logs/mcp_services.log"
fi
echo ""

# Step 2: Start Config API
echo -e "${GREEN}🔧 [2/4] Starting Config API (port 8004)...${NC}"
python config_api.py > logs/config_api.log 2>&1 &
CONFIG_API_PID=$!
sleep 2
echo "   ✅ Config API started (PID: $CONFIG_API_PID)"
echo ""

# Step 3: Start Strategy API
echo -e "${GREEN}🔧 [3/4] Starting Strategy API (port 8005)...${NC}"
python platform/strategy_api.py > logs/strategy_api.log 2>&1 &
STRATEGY_API_PID=$!
sleep 2
echo "   ✅ Strategy API started (PID: $STRATEGY_API_PID)"
echo ""

# Step 4: Start Frontend
echo -e "${GREEN}🔧 [4/4] Starting Frontend Server (port 8000)...${NC}"
cd docs
python3 -m http.server 8000 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 1
echo "   ✅ Frontend Server started (PID: $FRONTEND_PID)"
echo ""

# Save PIDs for cleanup
echo "$MCP_PID" > .platform_pids
echo "$CONFIG_API_PID" >> .platform_pids
echo "$STRATEGY_API_PID" >> .platform_pids
echo "$FRONTEND_PID" >> .platform_pids

echo "=========================================="
echo -e "${GREEN}🎉 AI-Trader Platform Started!${NC}"
echo "=========================================="
echo ""
echo "📋 Service URLs:"
echo "   - Frontend:        http://localhost:8000"
echo "   - Config API:      http://localhost:8004"
echo "   - Strategy API:    http://localhost:8005"
echo ""
echo "📊 MCP Services:"
echo "   - Math:            http://localhost:8000"
echo "   - Search:          http://localhost:8001"
echo "   - Trade:            http://localhost:8002"
echo "   - Price:           http://localhost:8003"
echo ""
echo -e "${YELLOW}💡 To stop all services, run: ./stop.sh${NC}"
echo -e "${YELLOW}💡 Or press Ctrl+C to stop this script${NC}"
echo ""

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping services...'; ./stop.sh; exit" INT TERM

# Keep script running
wait

