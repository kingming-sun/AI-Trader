"""
BaseAgent class - Base class for trading agents
Encapsulates core functionality including MCP tool management, AI agent creation, and trading execution
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from dotenv import load_dotenv

# Import project tools
import sys
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from tools.general_tools import extract_conversation, extract_tool_messages, get_config_value, write_config_value
from tools.price_tools import add_no_trade_record
from prompts.agent_prompt import get_agent_system_prompt, STOP_SIGNAL

# Load environment variables
load_dotenv()


class BaseAgent:
    """
    Base class for trading agents
    
    Main functionalities:
    1. MCP tool management and connection
    2. AI agent creation and configuration
    3. Trading execution and decision loops
    4. Logging and management
    5. Position and configuration management
    """
    
    # Default NASDAQ 100 stock symbols
    DEFAULT_STOCK_SYMBOLS = [
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
    
    def __init__(
        self,
        signature: str,
        basemodel: str,
        stock_symbols: Optional[List[str]] = None,
        mcp_config: Optional[Dict[str, Dict[str, Any]]] = None,
        log_path: Optional[str] = None,
        max_steps: int = 10,
        max_retries: int = 3,
        base_delay: float = 0.5,
        openai_base_url: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        initial_cash: float = 10000.0,
        init_date: str = "2025-10-13"
    ):
        """
        Initialize BaseAgent
        
        Args:
            signature: Agent signature/name
            basemodel: Base model name
            stock_symbols: List of stock symbols, defaults to NASDAQ 100
            mcp_config: MCP tool configuration, including port and URL information
            log_path: Log path, defaults to ./data/agent_data
            max_steps: Maximum reasoning steps
            max_retries: Maximum retry attempts
            base_delay: Base delay time for retries
            openai_base_url: OpenAI API base URL
            openai_api_key: OpenAI API key
            initial_cash: Initial cash amount
            init_date: Initialization date
        """
        self.signature = signature
        self.basemodel = basemodel
        self.stock_symbols = stock_symbols or self.DEFAULT_STOCK_SYMBOLS
        self.max_steps = max_steps
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.initial_cash = initial_cash
        self.init_date = init_date
        
        # Set MCP configuration
        self.mcp_config = mcp_config or self._get_default_mcp_config()
        
        # Set log path
        self.base_log_path = log_path or "./data/agent_data"
        
        # Set OpenAI configuration
        # Use environment variables if not provided or if empty string
        if openai_base_url is None or openai_base_url == "":
            self.openai_base_url = os.getenv("OPENAI_API_BASE")
        else:
            self.openai_base_url = openai_base_url
        if openai_api_key is None or openai_api_key == "":
            self.openai_api_key = os.getenv("OPENAI_API_KEY")
        else:
            self.openai_api_key = openai_api_key
        
        # Initialize components
        self.client: Optional[MultiServerMCPClient] = None
        self.tools: Optional[List] = None
        self.model: Optional[ChatOpenAI] = None
        self.agent: Optional[Any] = None
        
        # Data paths - Use the path directly as it's already properly structured
        # The log_path parameter should already include the full path from run_manager
        self.data_path = self.base_log_path  # Use base_log_path directly
        self.position_file = os.path.join(self.data_path, "position", "position.jsonl")
        
    def _get_default_mcp_config(self) -> Dict[str, Dict[str, Any]]:
        """Get default MCP configuration"""
        return {
            "math": {
                "transport": "streamable_http",
                "url": f"http://localhost:{os.getenv('MATH_HTTP_PORT', '8000')}/mcp",
            },
            "stock_local": {
                "transport": "streamable_http",
                "url": f"http://localhost:{os.getenv('GETPRICE_HTTP_PORT', '8003')}/mcp",
            },
            "search": {
                "transport": "streamable_http",
                "url": f"http://localhost:{os.getenv('SEARCH_HTTP_PORT', '8001')}/mcp",
            },
            "trade": {
                "transport": "streamable_http",
                "url": f"http://localhost:{os.getenv('TRADE_HTTP_PORT', '8002')}/mcp",
            },
        }
    
    async def initialize(self) -> None:
        """Initialize MCP client and AI model"""
        print(f"🚀 Initializing agent: {self.signature}")
        
        try:
            # Create MCP client
            self.client = MultiServerMCPClient(self.mcp_config)
            
            # Get tools
            self.tools = await self.client.get_tools()
            print(f"✅ Loaded {len(self.tools)} MCP tools")
        except Exception as e:
            print(f"❌ Failed to initialize MCP client: {e}")
            print(f"   Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            raise
        
        # Create AI model
        self.model = ChatOpenAI(
            model=self.basemodel,
            base_url=self.openai_base_url,
            api_key=self.openai_api_key,
            max_retries=3,
            timeout=30
        )
        
        # Initialize Moomoo client if real trading mode is enabled
        if os.getenv("USE_MOOMOO", "false").lower() == "true":
            try:
                from agent_tools.moomoo_client import init_moomoo_client
                print("🔄 Initializing Moomoo client for real trading...")
                if init_moomoo_client():
                    print("✅ Moomoo client initialized successfully")
                else:
                    print("❌ Failed to initialize Moomoo client")
                    print("   Continuing without real trading features")
            except ImportError as e:
                print(f"⚠️  Moomoo client module not available: {e}")
                print("   Continuing in simulation mode")
            except Exception as e:
                print(f"❌ Error initializing Moomoo client: {e}")
                print("   Continuing in simulation mode")
        
        # Note: agent will be created in run_trading_session() based on specific date
        # because system_prompt needs the current date and price information
        
        print(f"✅ Agent {self.signature} initialization completed")
    
    def _setup_logging(self, today_date: str) -> str:
        """Set up log file path"""
        # Use data_path directly as it already contains the full path
        log_path = os.path.join(self.data_path, 'log', today_date)
        if not os.path.exists(log_path):
            os.makedirs(log_path)
        return os.path.join(log_path, "log.jsonl")
    
    def _log_message(self, log_file: str, new_messages: List[Dict[str, str]]) -> None:
        """Log messages to log file"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "signature": self.signature,
            "new_messages": new_messages
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    async def _ainvoke_with_retry(self, message: List[Dict[str, str]]) -> Any:
        """Agent invocation with retry"""
        for attempt in range(1, self.max_retries + 1):
            try:
                return await self.agent.ainvoke(
                    {"messages": message}, 
                    {"recursion_limit": 100}
                )
            except Exception as e:
                if attempt == self.max_retries:
                    raise e
                print(f"⚠️ Attempt {attempt} failed, retrying after {self.base_delay * attempt} seconds...")
                print(f"Error details: {e}")
                await asyncio.sleep(self.base_delay * attempt)
    
    async def run_trading_session(self, today_date: str) -> None:
        """
        Run single day trading session
        
        Args:
            today_date: Trading date
        """
        print(f"📈 Starting trading session: {today_date}")
        
        # Set up logging
        log_file = self._setup_logging(today_date)
        
        # Update system prompt
        self.agent = create_agent(
            self.model,
            tools=self.tools,
            system_prompt=get_agent_system_prompt(today_date, self.signature),
        )
        
        # Initial user query
        user_query = [{"role": "user", "content": f"Please analyze and update today's ({today_date}) positions."}]
        message = user_query.copy()
        
        # Log initial message
        self._log_message(log_file, user_query)
        
        # Trading loop
        current_step = 0
        while current_step < self.max_steps:
            current_step += 1
            print(f"🔄 Step {current_step}/{self.max_steps}")
            
            try:
                # Call agent
                response = await self._ainvoke_with_retry(message)
                
                # Extract agent response
                agent_response = extract_conversation(response, "final")
                
                # Check stop signal
                if STOP_SIGNAL in agent_response:
                    print("✅ Received stop signal, trading session ended")
                    print(agent_response)
                    self._log_message(log_file, [{"role": "assistant", "content": agent_response}])
                    break
                
                # Extract tool messages
                tool_msgs = extract_tool_messages(response)
                tool_response = '\n'.join([msg.content for msg in tool_msgs])
                
                # Prepare new messages
                new_messages = [
                    {"role": "assistant", "content": agent_response},
                    {"role": "user", "content": f'Tool results: {tool_response}'}
                ]
                
                # Add new messages
                message.extend(new_messages)
                
                # Log messages (ensure we pass a list, not individual items)
                self._log_message(log_file, new_messages)
                
            except Exception as e:
                print(f"❌ Trading session error: {str(e)}")
                print(f"Error details: {e}")
                raise
        
        # Handle trading results
        await self._handle_trading_result(today_date)
    
    async def _handle_trading_result(self, today_date: str) -> None:
        """Handle trading results"""
        if_trade = get_config_value("IF_TRADE")
        if if_trade:
            write_config_value("IF_TRADE", False)
            print("✅ Trading completed")
        else:
            print("📊 No trading, maintaining positions")
            try:
                add_no_trade_record(today_date, self.signature)
            except NameError as e:
                print(f"❌ NameError: {e}")
                raise
            write_config_value("IF_TRADE", False)
    
    def register_agent(self) -> None:
        """Register new agent, create initial positions"""
        # Check if position.jsonl file already exists
        if os.path.exists(self.position_file):
            print(f"⚠️ Position file {self.position_file} already exists, skipping registration")
            return
        
        # Create initial position using init_date
        self._create_initial_position(self.init_date)
    
    def _create_initial_position(self, position_date: str) -> None:
        """
        Create initial position record for a specific date
        
        Args:
            position_date: Date for the initial position (usually the backtest start date)
        """
        # Ensure directory structure exists
        position_dir = os.path.join(self.data_path, "position")
        if not os.path.exists(position_dir):
            os.makedirs(position_dir)
            print(f"📁 Created position directory: {position_dir}")
        
        # Create initial positions
        init_position = {symbol: 0 for symbol in self.stock_symbols}
        init_position['CASH'] = self.initial_cash
        
        # Check if a position record already exists for this date
        position_exists = False
        if os.path.exists(self.position_file):
            with open(self.position_file, "r") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        doc = json.loads(line)
                        if doc.get("date") == position_date:
                            positions = doc.get("positions", {})
                            # Check if it has actual data
                            if positions and (positions.get("CASH", 0) > 0 or any(v > 0 for k, v in positions.items() if k != "CASH")):
                                position_exists = True
                                break
                    except:
                        continue
        
        if position_exists:
            print(f"ℹ️  Initial position for {position_date} already exists, skipping creation")
            return
        
        # Append to existing file or create new file
        with open(self.position_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "date": position_date, 
                "id": 0, 
                "positions": init_position
            }, ensure_ascii=False) + "\n")
        
        print(f"✅ Created initial position for {position_date}")
        print(f"📁 Position file: {self.position_file}")
        print(f"💰 Initial cash: ${self.initial_cash}")
        print(f"📊 Number of stocks: {len(self.stock_symbols)}")
    
    def get_trading_dates(self, init_date: str, end_date: str) -> List[str]:
        """
        Get trading date list
        
        Args:
            init_date: Start date
            end_date: End date
            
        Returns:
            List of trading dates
        """
        dates = []
        max_date = None
        
        # Parse date range first to filter position records
        init_date_obj = datetime.strptime(init_date, "%Y-%m-%d")
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        
        if not os.path.exists(self.position_file):
            # Create initial position for this backtest
            self._create_initial_position(init_date)
            max_date = init_date
        else:
            # Check if we need to create initial position for this backtest date range
            has_init_position = False
            with open(self.position_file, "r") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        doc = json.loads(line)
                        current_date = doc.get('date')
                        if not current_date:
                            continue
                        current_date_obj = datetime.strptime(current_date, "%Y-%m-%d")
                        
                        # Check if there's an initial position for this backtest date range
                        if current_date == init_date:
                            positions = doc.get("positions", {})
                            # Check if positions has actual data (CASH > 0 or any stock > 0)
                            if positions and (positions.get("CASH", 0) > 0 or any(v > 0 for k, v in positions.items() if k != "CASH")):
                                has_init_position = True
                                break
                    except:
                        continue
            
            # If no initial position found for this backtest, create one
            if not has_init_position:
                print(f"📅 No initial position found for backtest start date {init_date}, creating new initial position...")
                self._create_initial_position(init_date)
            
            # Read existing position file, find latest date within the requested range
            with open(self.position_file, "r") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        doc = json.loads(line)
                        current_date = doc.get('date')
                        if not current_date:
                            continue
                        current_date_obj = datetime.strptime(current_date, "%Y-%m-%d")
                        
                        # Only consider dates within the requested range
                        if init_date_obj <= current_date_obj <= end_date_obj:
                            if max_date is None:
                                max_date = current_date
                            else:
                                max_date_obj = datetime.strptime(max_date, "%Y-%m-%d")
                                if current_date_obj > max_date_obj:
                                    max_date = current_date
                    except:
                        continue
        
        # If no date found in range, start from init_date
        if max_date is None:
            max_date = init_date
        
        # Check if new dates need to be processed
        max_date_obj = datetime.strptime(max_date, "%Y-%m-%d")
        init_date_obj = datetime.strptime(init_date, "%Y-%m-%d")
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Determine start date: respect init_date, but also allow resuming
        # If max_date is before init_date, start from init_date
        # If max_date is on or after init_date but within the range, start from the day after max_date
        # If max_date is after end_date, ignore it and start from init_date (different date range)
        if max_date_obj < init_date_obj:
            start_date_obj = init_date_obj
            print(f"📅 Last processed date ({max_date}) is before init_date ({init_date}), starting from {init_date}")
        elif max_date_obj > end_date_obj:
            # max_date is outside the requested range, ignore it and start from init_date
            start_date_obj = init_date_obj
            print(f"📅 Last processed date ({max_date}) is after end_date ({end_date}), starting from {init_date} (new date range)")
        else:
            # max_date is within the range, resume from the day after
            start_date_obj = max_date_obj + timedelta(days=1)
            print(f"📅 Resuming from {start_date_obj.strftime('%Y-%m-%d')} (last processed: {max_date})")
        
        # Ensure we don't exceed end_date
        if end_date_obj < start_date_obj:
            print(f"ℹ️  All dates in range [{init_date}, {end_date}] have been processed (last processed: {max_date})")
            return []
        
        # Generate trading date list within the configured range
        trading_dates = []
        current_date = start_date_obj
        
        while current_date <= end_date_obj:
            if current_date.weekday() < 5:  # Weekdays only
                trading_dates.append(current_date.strftime("%Y-%m-%d"))
            current_date += timedelta(days=1)
        
        if trading_dates:
            print(f"📅 Will process dates from {trading_dates[0]} to {trading_dates[-1]} (total: {len(trading_dates)} days)")
        else:
            print(f"ℹ️  No trading days in range [{start_date_obj.strftime('%Y-%m-%d')}, {end_date}]")
        
        return trading_dates
    
    async def run_with_retry(self, today_date: str) -> None:
        """Run method with retry"""
        for attempt in range(1, self.max_retries + 1):
            try:
                print(f"🔄 Attempting to run {self.signature} - {today_date} (Attempt {attempt})")
                await self.run_trading_session(today_date)
                print(f"✅ {self.signature} - {today_date} run successful")
                return
            except Exception as e:
                print(f"❌ Attempt {attempt} failed: {str(e)}")
                if attempt == self.max_retries:
                    print(f"💥 {self.signature} - {today_date} all retries failed")
                    raise
                else:
                    wait_time = self.base_delay * attempt
                    print(f"⏳ Waiting {wait_time} seconds before retry...")
                    await asyncio.sleep(wait_time)
    
    async def run_date_range(self, init_date: str, end_date: str) -> None:
        """
        Run all trading days in date range
        
        Args:
            init_date: Start date
            end_date: End date
        """
        print(f"📅 Running date range: {init_date} to {end_date}")
        
        # Get trading date list
        trading_dates = self.get_trading_dates(init_date, end_date)
        
        if not trading_dates:
            print(f"ℹ️ No trading days to process")
            return
        
        print(f"📊 Trading days to process: {trading_dates}")
        
        # Process each trading day
        for date in trading_dates:
            print(f"🔄 Processing {self.signature} - Date: {date}")
            
            # Set configuration
            write_config_value("TODAY_DATE", date)
            write_config_value("SIGNATURE", self.signature)
            
            try:
                await self.run_with_retry(date)
            except Exception as e:
                print(f"❌ Error processing {self.signature} - Date: {date}")
                print(e)
                raise
        
        print(f"✅ {self.signature} processing completed")
    
    def get_position_summary(self) -> Dict[str, Any]:
        """Get position summary"""
        if not os.path.exists(self.position_file):
            return {"error": "Position file does not exist"}
        
        positions = []
        with open(self.position_file, "r") as f:
            for line in f:
                positions.append(json.loads(line))
        
        if not positions:
            return {"error": "No position records"}
        
        latest_position = positions[-1]
        return {
            "signature": self.signature,
            "latest_date": latest_position.get("date"),
            "positions": latest_position.get("positions", {}),
            "total_records": len(positions)
        }
    
    def __str__(self) -> str:
        return f"BaseAgent(signature='{self.signature}', basemodel='{self.basemodel}', stocks={len(self.stock_symbols)})"
    
    def __repr__(self) -> str:
        return self.__str__()
