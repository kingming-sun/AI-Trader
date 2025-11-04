#!/usr/bin/env python3
"""
Data Validator and Downloader
Validates that local data covers the requested date range for backtesting
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Tuple, Set, Optional
import subprocess


def get_available_dates(data_file: Path) -> Set[str]:
    """Get all available dates from the local data file"""
    dates = set()
    
    if not data_file.exists():
        print(f"❌ Data file not found: {data_file}")
        return dates
    
    with open(data_file, 'r') as f:
        for line in f:
            try:
                data = json.loads(line)
                if 'Time Series (Daily)' in data:
                    for date in data['Time Series (Daily)'].keys():
                        dates.add(date)
            except json.JSONDecodeError:
                continue
    
    return dates


def get_trading_dates(start_date: str, end_date: str) -> List[str]:
    """Get all trading dates (excluding weekends) in the range"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    trading_dates = []
    current = start
    
    while current <= end:
        # Skip weekends (Saturday=5, Sunday=6)
        if current.weekday() < 5:
            trading_dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    return trading_dates


def validate_date_coverage(start_date: str, end_date: str, data_file: Path) -> Tuple[bool, List[str]]:
    """
    Check if local data covers the requested date range
    
    Returns:
        Tuple of (is_valid, missing_dates)
    """
    # Get available dates from data file
    available_dates = get_available_dates(data_file)
    
    if not available_dates:
        return False, []
    
    # Get required trading dates
    required_dates = get_trading_dates(start_date, end_date)
    
    # Find missing dates
    missing_dates = []
    for date in required_dates:
        if date not in available_dates:
            missing_dates.append(date)
    
    is_valid = len(missing_dates) == 0
    
    return is_valid, missing_dates


def get_data_date_range(data_file: Path) -> Tuple[Optional[str], Optional[str]]:
    """Get the min and max dates available in the data file"""
    dates = get_available_dates(data_file)
    
    if not dates:
        return None, None
    
    sorted_dates = sorted(dates)
    return sorted_dates[0], sorted_dates[-1]


def download_missing_data(symbols: List[str], start_date: str, end_date: str) -> bool:
    """
    Download missing data for the specified date range
    
    Note: This is a placeholder. In production, you would implement
    actual data download from your data provider (Alpha Vantage, Yahoo Finance, etc.)
    """
    print(f"📥 Downloading data for {len(symbols)} symbols from {start_date} to {end_date}...")
    
    # TODO: Implement actual data download
    # For now, we'll just show what needs to be done
    print("⚠️  Data download not yet implemented.")
    print("   Please ensure your data file (data/merged.jsonl) contains data for the requested date range.")
    print("\n   Options:")
    print("   1. Use the existing data download script")
    print("   2. Adjust your backtest date range to match available data")
    print("   3. Manually download and merge the required data")
    
    return False


def suggest_valid_date_range(data_file: Path, requested_start: str, requested_end: str) -> Tuple[str, str]:
    """
    Suggest a valid date range based on available data
    """
    min_date, max_date = get_data_date_range(data_file)
    
    if not min_date or not max_date:
        return requested_start, requested_end
    
    # Adjust dates to fit within available data
    suggested_start = max(requested_start, min_date)
    suggested_end = min(requested_end, max_date)
    
    # Ensure start is before end
    if suggested_start > suggested_end:
        suggested_start = min_date
        suggested_end = max_date
    
    return suggested_start, suggested_end


def validate_backtest_data(strategy_id: str, mode: str = "backtest") -> dict:
    """
    Validate data availability for a strategy's backtest
    
    Returns:
        Dictionary with validation results and suggestions
    """
    result = {
        "valid": False,
        "message": "",
        "missing_dates": [],
        "available_range": {},
        "suggested_range": {},
        "action_required": None
    }
    
    # Get strategy config
    config_file = Path(f"configs/strategies/{strategy_id}/{mode}_config.json")
    if not config_file.exists():
        result["message"] = f"Configuration file not found: {config_file}"
        result["action_required"] = "CREATE_CONFIG"
        return result
    
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    # Get date range from config
    date_range = config.get("date_range", {})
    start_date = date_range.get("init_date")
    end_date = date_range.get("end_date")
    
    if not start_date or not end_date:
        result["message"] = "Date range not configured"
        result["action_required"] = "SET_DATE_RANGE"
        return result
    
    # Check data file
    data_file = Path("data/merged.jsonl")
    if not data_file.exists():
        result["message"] = "Data file not found: data/merged.jsonl"
        result["action_required"] = "DOWNLOAD_DATA"
        return result
    
    # Get available date range
    min_date, max_date = get_data_date_range(data_file)
    if min_date and max_date:
        result["available_range"] = {
            "start": min_date,
            "end": max_date
        }
    
    # Validate date coverage
    is_valid, missing_dates = validate_date_coverage(start_date, end_date, data_file)
    
    result["valid"] = is_valid
    result["missing_dates"] = missing_dates
    
    if is_valid:
        result["message"] = f"✅ Data is available for the entire range: {start_date} to {end_date}"
    else:
        # Suggest alternative date range
        suggested_start, suggested_end = suggest_valid_date_range(data_file, start_date, end_date)
        result["suggested_range"] = {
            "start": suggested_start,
            "end": suggested_end
        }
        
        if len(missing_dates) > 0:
            result["message"] = f"⚠️  Missing data for {len(missing_dates)} dates"
            result["action_required"] = "ADJUST_DATES_OR_DOWNLOAD"
            
            # Show sample of missing dates
            sample_missing = missing_dates[:5]
            if len(missing_dates) > 5:
                sample_missing.append(f"... and {len(missing_dates) - 5} more")
            
            print(f"\n⚠️  Missing dates: {sample_missing}")
            print(f"   Available data range: {min_date} to {max_date}")
            print(f"   Requested range: {start_date} to {end_date}")
            print(f"   ✅ Suggested range: {suggested_start} to {suggested_end}")
    
    return result


def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python data_validator.py <strategy_id> [mode]")
        print("Example: python data_validator.py strategy_20251104_141923 backtest")
        return
    
    strategy_id = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "backtest"
    
    print(f"🔍 Validating data for strategy: {strategy_id} (mode: {mode})")
    
    result = validate_backtest_data(strategy_id, mode)
    
    print(f"\n📊 Validation Result:")
    print(f"   Status: {'✅ Valid' if result['valid'] else '❌ Invalid'}")
    print(f"   Message: {result['message']}")
    
    if result["available_range"]:
        print(f"   Available data: {result['available_range']['start']} to {result['available_range']['end']}")
    
    if result["suggested_range"]:
        print(f"   Suggested range: {result['suggested_range']['start']} to {result['suggested_range']['end']}")
    
    if result["action_required"]:
        print(f"\n⚠️  Action required: {result['action_required']}")
        
        if result["action_required"] == "ADJUST_DATES_OR_DOWNLOAD":
            print("\n   Options:")
            print("   1. Adjust your backtest dates to match available data")
            print("   2. Download additional data for the missing dates")
            print("   3. Use the suggested date range shown above")
    
    return result


if __name__ == "__main__":
    main()