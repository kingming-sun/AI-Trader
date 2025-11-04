#!/usr/bin/env python3
"""Test price API fallback functionality"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up the path for agent_tools
from agent_tools.tool_get_price_local import get_price_local_function
import json

def test_price_api():
    """Test price fetching with API fallback"""
    
    print("🧪 Testing price API fallback...")
    
    # Test 1: Date within local data range
    print("\n1️⃣ Testing with date in local data range (2025-10-25):")
    result = get_price_local_function("AAPL", "2025-10-25")
    if "error" not in result:
        print(f"   ✅ Success: Got price ${result['ohlcv']['close']}")
        print(f"   Source: {result.get('source', 'local')}")
    else:
        print(f"   ❌ Error: {result['error']}")
    
    # Test 2: Date outside local data range (should trigger API)
    print("\n2️⃣ Testing with date outside local range (2025-11-01):")
    result = get_price_local_function("AAPL", "2025-11-01")
    if "error" not in result:
        print(f"   ✅ Success: Got price ${result['ohlcv']['close']}")
        print(f"   Source: {result.get('source', 'alpha_vantage_api')}")
    else:
        print(f"   ❌ Error: {result['error']}")
    
    # Test 3: Future date (should fail even with API)
    print("\n3️⃣ Testing with future date (2026-01-01):")
    result = get_price_local_function("AAPL", "2026-01-01")
    if "error" not in result:
        print(f"   ✅ Success: Got price ${result['ohlcv']['close']}")
        print(f"   Source: {result.get('source', 'unknown')}")
    else:
        print(f"   ⚠️  Expected error: {result['error'][:100]}...")
    
    print("\n✅ Test complete!")

if __name__ == "__main__":
    test_price_api()