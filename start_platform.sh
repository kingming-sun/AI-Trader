#!/bin/bash
# AI-Trader Platform Startup Script
# Starts all required services for the platform

set -e

echo "🚀 Starting AI-Trader Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not detected. Activating...${NC}"
    if [ -d "venv" ]; then
        source venv/bin/activate
    else
        echo -e "${RED}❌ Virtual environment not found. Please create one first.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Virtual environment activated${NC}"
echo ""

# Step 1: Start MCP Services
echo "🔧 Step 1: Starting MCP Services..."
cd agent_tools
python start_mcp_services.py &
MCP_PID=$!
cd ..
sleep 3
echo -e "${GREEN}✅ MCP Services started (PID: $MCP_PID)${NC}"
echo ""

# Step 2: Start Config API
echo "🔧 Step 2: Starting Config API (port 8004)..."
python config_api.py &
CONFIG_API_PID=$!
sleep 2
echo -e "${GREEN}✅ Config API started (PID: $CONFIG_API_PID)${NC}"
echo ""

# Step 3: Start Strategy API
echo "🔧 Step 3: Starting Strategy API (port 8005)..."
python platform/strategy_api.py &
STRATEGY_API_PID=$!
sleep 2
echo -e "${GREEN}✅ Strategy API started (PID: $STRATEGY_API_PID)${NC}"
echo ""

# Step 4: Start Frontend Server
echo "🔧 Step 4: Starting Frontend Server (port 8000)..."
cd docs
python3 -m http.server 8000 &
FRONTEND_PID=$!
cd ..
sleep 1
echo -e "${GREEN}✅ Frontend Server started (PID: $FRONTEND_PID)${NC}"
echo ""

# Save PIDs to file for cleanup
echo "$MCP_PID" > .platform_pids
echo "$CONFIG_API_PID" >> .platform_pids
echo "$STRATEGY_API_PID" >> .platform_pids
echo "$FRONTEND_PID" >> .platform_pids

echo "=========================================="
echo -e "${GREEN}🎉 AI-Trader Platform Started!${NC}"
echo "=========================================="
echo ""
echo "📋 Service Information:"
echo "  - MCP Services:"
echo "    - Math: http://localhost:8000"
echo "    - Search: http://localhost:8001"
echo "    - Trade: http://localhost:8002"
echo "    - Price: http://localhost:8003"
echo "  - Config API: http://localhost:8004"
echo "  - Strategy API: http://localhost:8005"
echo "  - Frontend: http://localhost:8000"
echo ""
echo "🌐 Access the platform at: http://localhost:8000"
echo ""
echo -e "${YELLOW}⚠️  To stop all services, run: ./stop_platform.sh${NC}"
echo ""

# Keep script running
wait

