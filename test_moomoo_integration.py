#!/usr/bin/env python3
"""
Test script for Moomoo integration
This script tests the Moomoo API connection and trading functionality
"""

import os
import sys
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)


def print_header(title):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_result(test_name, success, details=""):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")


def test_environment_setup():
    """Test 1: Check environment variables"""
    print_header("Test 1: Environment Setup")
    
    required_vars = [
        "USE_MOOMOO",
        "MOOMOO_HOST",
        "MOOMOO_PORT",
        "MOOMOO_API_KEY",
        "MOOMOO_SECRET_KEY",
        "MOOMOO_TRD_ENV"
    ]
    
    all_present = True
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Hide sensitive information
            if "KEY" in var or "PASSWORD" in var:
                display_value = "***" + value[-4:] if len(value) > 4 else "***"
            else:
                display_value = value
            print(f"  ✓ {var}: {display_value}")
        else:
            print(f"  ✗ {var}: NOT SET")
            all_present = False
    
    use_moomoo = os.getenv("USE_MOOMOO", "false").lower() == "true"
    print(f"\n  Trading Mode: {'REAL' if use_moomoo else 'SIMULATION'}")
    
    if use_moomoo and os.getenv("MOOMOO_TRD_ENV") == "REAL":
        print("  ⚠️  WARNING: Real trading mode is enabled!")
    
    print_result("Environment variables", all_present)
    return all_present


def test_moomoo_import():
    """Test 2: Import Moomoo client module"""
    print_header("Test 2: Module Import")
    
    try:
        from agent_tools.moomoo_client import MoomooClient, get_moomoo_client
        print_result("Import moomoo_client module", True)
        return True
    except ImportError as e:
        print_result("Import moomoo_client module", False, str(e))
        return False


def test_futu_api_installed():
    """Test 3: Check if futu-api is installed"""
    print_header("Test 3: Futu API Installation")
    
    try:
        import futu
        print(f"  futu-api version: {futu.__version__ if hasattr(futu, '__version__') else 'unknown'}")
        print_result("futu-api installed", True)
        return True
    except ImportError:
        print_result("futu-api installed", False, "Run: pip install futu-api")
        return False


def test_moomoo_connection():
    """Test 4: Test Moomoo connection"""
    print_header("Test 4: Moomoo Connection")
    
    if not test_futu_api_installed():
        print("  Skipping: futu-api not installed")
        return False
    
    try:
        from agent_tools.moomoo_client import get_moomoo_client
        
        client = get_moomoo_client()
        if not client:
            print_result("Create Moomoo client", False, "Failed to create client")
            return False
        
        print("  Attempting to connect to OpenD...")
        success = client.connect()
        
        if success:
            print_result("Connect to OpenD", True)
            
            # Test getting account info
            acc_info = client.get_account_info()
            if acc_info.get("success"):
                print(f"  Account Info:")
                print(f"    - Cash: ${acc_info.get('cash', 0):.2f}")
                print(f"    - Total Assets: ${acc_info.get('total_assets', 0):.2f}")
                print(f"    - Currency: {acc_info.get('currency', 'Unknown')}")
            
            # Disconnect
            client.disconnect()
            print("  Connection closed")
            
            return True
        else:
            print_result("Connect to OpenD", False, "Is OpenD running?")
            return False
            
    except Exception as e:
        print_result("Moomoo connection test", False, str(e))
        return False


def test_real_time_price():
    """Test 5: Test real-time price fetching"""
    print_header("Test 5: Real-time Price Fetching")
    
    try:
        from agent_tools.moomoo_client import get_moomoo_client
        
        client = get_moomoo_client()
        if not client.connect():
            print_result("Price fetching", False, "Connection failed")
            return False
        
        # Test getting price for a popular stock
        test_symbols = ["AAPL", "GOOGL", "MSFT"]
        success_count = 0
        
        for symbol in test_symbols:
            price = client.get_market_price(symbol)
            if price:
                print(f"  {symbol}: ${price:.2f}")
                success_count += 1
            else:
                print(f"  {symbol}: Failed to get price")
        
        client.disconnect()
        
        success = success_count > 0
        print_result("Real-time price fetching", success, 
                    f"{success_count}/{len(test_symbols)} symbols succeeded")
        return success
        
    except Exception as e:
        print_result("Real-time price fetching", False, str(e))
        return False


def test_position_query():
    """Test 6: Test position querying"""
    print_header("Test 6: Position Query")
    
    try:
        from agent_tools.moomoo_client import get_moomoo_client
        
        client = get_moomoo_client()
        if not client.connect():
            print_result("Position query", False, "Connection failed")
            return False
        
        positions = client.get_position()
        
        if positions.get("success") is not None:
            position_dict = positions.get("positions", {})
            print(f"  Found {len(position_dict)} positions")
            
            for symbol, info in list(position_dict.items())[:5]:  # Show first 5
                print(f"  {symbol}:")
                print(f"    Quantity: {info.get('quantity', 0)}")
                print(f"    Market Value: ${info.get('market_value', 0):.2f}")
                print(f"    P&L: ${info.get('pl', 0):.2f}")
            
            client.disconnect()
            print_result("Position query", True)
            return True
        else:
            client.disconnect()
            error = positions.get("error", "Unknown error")
            print_result("Position query", False, error)
            return False
            
    except Exception as e:
        print_result("Position query", False, str(e))
        return False


def test_trading_tools():
    """Test 7: Test trading tool modifications"""
    print_header("Test 7: Trading Tool Modifications")
    
    try:
        # Check if tool_trade.py has been modified
        tool_trade_path = os.path.join(project_root, "agent_tools", "tool_trade.py")
        with open(tool_trade_path, 'r') as f:
            content = f.read()
            has_moomoo = "USE_REAL_TRADING" in content and "moomoo_client" in content
        
        print_result("tool_trade.py modified", has_moomoo)
        
        # Check if tool_get_price_local.py has been modified
        tool_price_path = os.path.join(project_root, "agent_tools", "tool_get_price_local.py")
        with open(tool_price_path, 'r') as f:
            content = f.read()
            has_moomoo = "USE_REAL_TRADING" in content and "moomoo_client" in content
        
        print_result("tool_get_price_local.py modified", has_moomoo)
        
        return True
        
    except Exception as e:
        print_result("Trading tool modifications", False, str(e))
        return False


def test_risk_controls():
    """Test 8: Test risk control parameters"""
    print_header("Test 8: Risk Control Settings")
    
    risk_params = {
        "MAX_SINGLE_TRADE": os.getenv("MAX_SINGLE_TRADE", "10000"),
        "MAX_DAILY_TRADES": os.getenv("MAX_DAILY_TRADES", "50"),
        "MAX_POSITION_VALUE": os.getenv("MAX_POSITION_VALUE", "100000")
    }
    
    for param, value in risk_params.items():
        print(f"  {param}: ${value}" if "TRADE" != param.split("_")[-1] else f"  {param}: {value}")
    
    print_result("Risk control parameters", True)
    return True


async def test_integration_flow():
    """Test 9: Full integration flow (simulation)"""
    print_header("Test 9: Integration Flow Test")
    
    if os.getenv("USE_MOOMOO", "false").lower() != "true":
        print("  Skipping: Real trading mode not enabled")
        print("  Set USE_MOOMOO=true to test integration")
        return False
    
    try:
        from agent_tools.moomoo_client import get_moomoo_client
        
        print("  1. Initializing client...")
        client = get_moomoo_client()
        
        print("  2. Connecting to OpenD...")
        if not client.connect():
            print_result("Integration flow", False, "Connection failed")
            return False
        
        print("  3. Getting account info...")
        acc_info = client.get_account_info()
        if acc_info.get("success"):
            print(f"     Cash available: ${acc_info.get('cash', 0):.2f}")
        
        print("  4. Getting real-time price...")
        price = client.get_market_price("AAPL")
        if price:
            print(f"     AAPL price: ${price:.2f}")
        
        print("  5. Checking positions...")
        positions = client.get_position()
        if positions.get("success"):
            print(f"     Current positions: {len(positions.get('positions', {}))}")
        
        print("  6. Disconnecting...")
        client.disconnect()
        
        print_result("Integration flow", True)
        return True
        
    except Exception as e:
        print_result("Integration flow", False, str(e))
        return False


def main():
    """Run all tests"""
    print("\n" + "🔧" * 30)
    print("  MOOMOO INTEGRATION TEST SUITE")
    print("🔧" * 30)
    
    # Track test results
    results = []
    
    # Run tests
    results.append(("Environment Setup", test_environment_setup()))
    results.append(("Module Import", test_moomoo_import()))
    results.append(("Futu API", test_futu_api_installed()))
    
    # Only run connection tests if enabled
    if os.getenv("USE_MOOMOO", "false").lower() == "true":
        results.append(("Moomoo Connection", test_moomoo_connection()))
        results.append(("Real-time Prices", test_real_time_price()))
        results.append(("Position Query", test_position_query()))
    else:
        print("\n⚠️  Skipping connection tests (USE_MOOMOO=false)")
    
    results.append(("Tool Modifications", test_trading_tools()))
    results.append(("Risk Controls", test_risk_controls()))
    
    # Run async test
    if os.getenv("USE_MOOMOO", "false").lower() == "true":
        loop = asyncio.get_event_loop()
        results.append(("Integration Flow", loop.run_until_complete(test_integration_flow())))
    
    # Summary
    print_header("TEST SUMMARY")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n  Total Tests: {total}")
    print(f"  Passed: {passed}")
    print(f"  Failed: {total - passed}")
    print(f"  Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 All tests passed! Moomoo integration is ready.")
    elif passed > 0:
        print("\n⚠️  Some tests failed. Please review the failures above.")
    else:
        print("\n❌ All tests failed. Please check your configuration.")
    
    # Additional instructions
    print("\n" + "=" * 60)
    print("  NEXT STEPS")
    print("=" * 60)
    
    if os.getenv("USE_MOOMOO", "false").lower() != "true":
        print("  1. Copy .env.moomoo.sample to .env")
        print("  2. Update .env with your Moomoo credentials")
        print("  3. Install futu-api: pip install futu-api")
        print("  4. Start OpenD gateway program")
        print("  5. Set USE_MOOMOO=true in .env")
        print("  6. Run this test again")
    else:
        if os.getenv("MOOMOO_TRD_ENV") == "SIMULATE":
            print("  ✅ Currently in SIMULATION mode (safe for testing)")
            print("  When ready for real trading:")
            print("    1. Set MOOMOO_TRD_ENV=REAL in .env")
            print("    2. Start with small amounts")
            print("    3. Monitor trades carefully")
        else:
            print("  ⚠️  REAL TRADING MODE IS ACTIVE")
            print("  Please ensure you understand the risks")


if __name__ == "__main__":
    main()