import os
import sys
from dotenv import load_dotenv
load_dotenv()
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
# Add project root directory to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
from tools.price_tools import get_yesterday_date, get_open_prices, get_yesterday_open_and_close_price, get_today_init_position, get_yesterday_profit
from tools.general_tools import get_config_value

all_nasdaq_100_symbols = [
    "NVDA", "MSFT", "AAPL", "GOOG", "GOOGL", "AMZN", "META", "AVGO", "TSLA",
    "NFLX", "PLTR", "COST", "ASML", "AMD", "CSCO", "AZN", "TMUS", "MU", "LIN",
    "PEP", "SHOP", "APP", "INTU", "AMAT", "LRCX", "PDD", "QCOM", "ARM", "INTC",
    "BKNG", "AMGN", "TXN", "ISRG", "GILD", "KLAC", "PANW", "ADBE", "HON",
    "CRWD", "CEG", "ADI", "ADP", "DASH", "CMCSA", "VRTX", "MELI", "SBUX",
    "CDNS", "ORLY", "SNPS", "MSTR", "MDLZ", "ABNB", "MRVL", "CTAS", "TRI",
    "MAR", "MNST", "CSX", "ADSK", "PYPL", "FTNT", "AEP", "WDAY", "REGN", "ROP",
    "NXPI", "DDOG", "AXON", "ROST", "IDXX", "EA", "PCAR", "FAST", "EXC", "TTWO",
    "XEL", "ZS", "PAYX", "WBD", "BKR", "CPRT", "CCEP", "FANG", "TEAM", "CHTR",
    "KDP", "MCHP", "GEHC", "VRSK", "CTSH", "CSGP", "KHC", "ODFL", "DXCM", "TTD",
    "ON", "BIIB", "LULU", "CDW", "GFS"
]

STOP_SIGNAL = "<FINISH_SIGNAL>"

agent_system_prompt = """
You are a stock fundamental analysis trading assistant.

Your goals are:
- Think and reason by calling available tools.
- You need to think about the prices of various stocks and their returns.
- Your long-term goal is to maximize returns through this portfolio.
- Before making decisions, gather as much information as possible through search tools to aid decision-making.

Thinking standards:
- Clearly show key intermediate steps:
  - Read input of yesterday's positions and today's prices
  - Update valuation and adjust weights for each target (if strategy requires)

Notes:
- You don't need to request user permission during operations, you can execute directly
- You must execute operations by calling tools, directly output operations will not be accepted

Here is the information you need:

Today's date:
{date}

Yesterday's closing positions (numbers after stock codes represent how many shares you hold, numbers after CASH represent your available cash):
{positions}

Yesterday's closing prices:
{yesterday_close_price}

Today's buying prices:
{today_buy_price}

When you think your task is complete, output
{STOP_SIGNAL}
"""

def load_strategy_prompt(strategy_id: str = None, mode: str = "backtest") -> Optional[str]:
    """
    Load prompt from strategy-specific file (JSON or Python format)
    
    Args:
        strategy_id: Strategy identifier (from environment variable STRATEGY_ID if not provided)
        mode: Trading mode (from environment variable TRADING_MODE if not provided)
    
    Returns:
        Prompt text if found, None otherwise
    """
    import json
    import re
    
    # Get strategy_id and mode from environment if not provided
    if strategy_id is None:
        strategy_id = os.getenv("STRATEGY_ID")
    if mode is None:
        mode = os.getenv("TRADING_MODE", "backtest")
    
    if not strategy_id:
        return None
    
    # Get strategy directory
    project_root = Path(__file__).parent.parent
    strategy_dir = project_root / "configs" / "strategies" / strategy_id
    prompts_dir = strategy_dir / "prompts"
    
    if not prompts_dir.exists():
        return None
    
    prompt_file = None
    
    # Try mode-specific JSON prompt first
    mode_prompt_json = prompts_dir / f"{mode}_prompt.json"
    if mode_prompt_json.exists():
        prompt_file = mode_prompt_json
    
    # Fallback to base JSON prompt
    if not prompt_file or not prompt_file.exists():
        base_prompt_json = prompts_dir / "base_prompt.json"
        if base_prompt_json.exists():
            prompt_file = base_prompt_json
    
    # Compatibility: Try old Python format if JSON doesn't exist
    if not prompt_file or not prompt_file.exists():
        mode_prompt_py = prompts_dir / f"{mode}_prompt.py"
        if mode_prompt_py.exists():
            prompt_file = mode_prompt_py
        else:
            base_prompt_py = prompts_dir / "base_prompt.py"
            if base_prompt_py.exists():
                prompt_file = base_prompt_py
    
    if not prompt_file or not prompt_file.exists():
        return None
    
    try:
        # Read JSON format
        if prompt_file.suffix == '.json':
            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompt_data = json.load(f)
                prompt = prompt_data.get('prompt', '').strip()
                return prompt if prompt else None
        
        # Read old Python format (for compatibility)
        if prompt_file.suffix == '.py':
            with open(prompt_file, 'r', encoding='utf-8') as f:
                content = f.read()
                # Try to match the prompt pattern
                match = re.search(r'agent_system_prompt = """([\s\S]*?)"""', content)
                if match:
                    prompt = match.group(1).strip()
                    return prompt if prompt else None
    except Exception as e:
        print(f"⚠️  Error loading strategy prompt from {prompt_file}: {e}")
        return None
    
    return None

def get_agent_system_prompt(today_date: str, signature: str) -> str:
    print(f"signature: {signature}")
    print(f"today_date: {today_date}")
    
    # Try to load strategy-specific prompt first
    strategy_prompt = load_strategy_prompt()
    prompt_template = strategy_prompt if strategy_prompt else agent_system_prompt
    
    # Get yesterday's buy and sell prices with error handling and progress logging
    print(f"📊 Fetching yesterday's prices for {len(all_nasdaq_100_symbols)} stocks...")
    print(f"   This may take approximately {len(all_nasdaq_100_symbols) * 0.45 / 60:.1f} minutes...")
    try:
        yesterday_buy_prices, yesterday_sell_prices = get_yesterday_open_and_close_price(today_date, all_nasdaq_100_symbols)
        print(f"✅ Successfully fetched yesterday's prices")
    except Exception as e:
        print(f"❌ Error fetching yesterday's prices: {e}")
        import traceback
        traceback.print_exc()
        # Use empty dicts as fallback
        yesterday_buy_prices, yesterday_sell_prices = {}, {}
    
    # Get today's buy prices with error handling and progress logging
    print(f"📊 Fetching today's prices for {len(all_nasdaq_100_symbols)} stocks...")
    print(f"   This may take approximately {len(all_nasdaq_100_symbols) * 0.45 / 60:.1f} minutes...")
    try:
        today_buy_price = get_open_prices(today_date, all_nasdaq_100_symbols)
        print(f"✅ Successfully fetched today's prices")
    except Exception as e:
        print(f"❌ Error fetching today's prices: {e}")
        import traceback
        traceback.print_exc()
        # Use empty dict as fallback
        today_buy_price = {}
    
    # Get today's initial position
    try:
        today_init_position = get_today_init_position(today_date, signature)
        print(f"✅ Successfully loaded initial position")
    except Exception as e:
        print(f"❌ Error loading initial position: {e}")
        import traceback
        traceback.print_exc()
        # Use empty dict as fallback
        today_init_position = {}
    
    # Format price data more compactly to reduce token usage
    # Only show stocks that have positions or significant price changes
    def format_price_dict(price_dict: Dict, max_items: int = 20) -> str:
        """Format price dictionary in a compact way, limiting items"""
        if not price_dict:
            return "No price data available"
        
        # Filter out None values and limit items
        valid_items = [(k, v) for k, v in price_dict.items() if v is not None][:max_items]
        if not valid_items:
            return "No valid price data"
        
        # Format as compact string
        lines = [f"{k}: {v:.2f}" for k, v in valid_items]
        result = "\n".join(lines)
        if len(price_dict) > max_items:
            result += f"\n... (showing {max_items} of {len(price_dict)} items)"
        return result
    
    # Format positions more compactly
    def format_positions(positions: Dict) -> str:
        """Format positions in a compact way"""
        if not positions:
            return "No positions"
        
        # Show CASH first, then stocks with non-zero positions
        lines = []
        if "CASH" in positions:
            lines.append(f"CASH: {positions['CASH']:.2f}")
        
        stock_positions = {k: v for k, v in positions.items() if k != "CASH" and v != 0}
        for symbol, shares in list(stock_positions.items())[:15]:  # Limit to 15 stocks
            lines.append(f"{symbol}: {shares:.4f}")
        
        if len(stock_positions) > 15:
            lines.append(f"... (showing 15 of {len(stock_positions)} positions)")
        
        return "\n".join(lines) if lines else "No positions"
    
    # Format prices compactly (limit to 20 items each)
    yesterday_close_str = format_price_dict(yesterday_sell_prices, max_items=20)
    today_buy_str = format_price_dict(today_buy_price, max_items=20)
    positions_str = format_positions(today_init_position)
    
    return prompt_template.format(
        date=today_date, 
        positions=positions_str, 
        STOP_SIGNAL=STOP_SIGNAL,
        yesterday_close_price=yesterday_close_str,
        today_buy_price=today_buy_str
    )



if __name__ == "__main__":
    today_date = get_config_value("TODAY_DATE")
    signature = get_config_value("SIGNATURE")
    if signature is None:
        raise ValueError("SIGNATURE environment variable is not set")
    print(get_agent_system_prompt(today_date, signature))  