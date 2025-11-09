#!/bin/bash
# AI-Trader Platform Restart Script
# Stops all services and then starts them again

echo "╔════════════════════════════════════════════╗"
echo "║      🔄 AI-Trader Platform Restart         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Stop all services
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Step 1: Stopping all services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if stop.sh exists and is executable
if [ -f "./stop.sh" ] && [ -x "./stop.sh" ]; then
    ./stop.sh
else
    echo -e "${RED}❌ stop.sh not found or not executable${NC}"
    exit 1
fi

# Wait a bit to ensure all processes are fully stopped
echo ""
echo "⏳ Waiting for services to fully stop..."
sleep 2

# Step 2: Start all services
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Step 2: Starting all services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if start.sh exists and is executable
if [ -f "./start.sh" ] && [ -x "./start.sh" ]; then
    ./start.sh
else
    echo -e "${RED}❌ start.sh not found or not executable${NC}"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║    ✅ Platform Restart Complete            ║"
echo "╚════════════════════════════════════════════╝"
echo ""

