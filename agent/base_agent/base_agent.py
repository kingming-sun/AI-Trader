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

try:
    from langchain_mcp_adapters.client import MultiServerMCPClient
except ImportError:
    print("⚠️ langchain_mcp_adapters not found, using local compatibility layer")
    from agent.base_agent.mcp_compat import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
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
        # Get Alpha Vantage API key from environment (try multiple spellings)
        alpha_vantage_key = (
            os.getenv("ALPHAVANTAGE_API_KEY") or 
            os.getenv("ALPHA_VANTAGE_API_KEY") or 
            os.getenv("ALPHAADVANTAGE_API_KEY") or 
            ""
        )
        
        config = {
            "math": {
                "transport": "streamable_http",
                "url": f"http://localhost:{os.getenv('MATH_HTTP_PORT', '8000')}/mcp",
            },
            "trade": {
                "transport": "streamable_http",
                "url": f"http://localhost:{os.getenv('TRADE_HTTP_PORT', '8002')}/mcp",
            },
        }
        
        # Add Alpha Vantage MCP server for price data and market information
        # Reference: https://github.com/alphavantage/alpha_vantage_mcp/blob/main/examples/agent/README.md
        if alpha_vantage_key:
            config["alphavantage"] = {
                "transport": "streamable_http",  # streamable_http transport for remote HTTP MCP servers
                "url": f"https://mcp.alphavantage.co/mcp?apikey={alpha_vantage_key}",
            }
            print(f"✅ Alpha Vantage MCP server configured (replaces LocalPrices and Search)")
        else:
            print("⚠️  ALPHAADVANTAGE_API_KEY not set, Alpha Vantage MCP server not available")
        
        return config
    
    async def initialize(self) -> None:
        """Initialize MCP client and AI model"""
        print(f"🚀 Initializing agent: {self.signature}")
        
        try:
            # Create MCP client
            print(f"📡 Connecting to MCP servers: {list(self.mcp_config.keys())}")
            self.client = MultiServerMCPClient(self.mcp_config)
            
            # Get tools from all MCP servers
            self.tools = await self.client.get_tools()
            
            # Display detailed tool information
            print(f"✅ Loaded {len(self.tools)} MCP tools from all servers")
            
            # Group tools by server for better visibility
            tool_info = {}
            for tool in self.tools:
                # Try multiple ways to get tool name (LangChain tools may have different structures)
                tool_name = None
                if hasattr(tool, 'name'):
                    tool_name = tool.name
                elif hasattr(tool, '__name__'):
                    tool_name = tool.__name__
                elif hasattr(tool, 'func') and hasattr(tool.func, '__name__'):
                    tool_name = tool.func.__name__
                else:
                    tool_name = str(tool)
                
                # Also check description for Alpha Vantage patterns
                tool_desc = ""
                if hasattr(tool, 'description'):
                    tool_desc = str(tool.description).upper()
                elif hasattr(tool, 'func') and hasattr(tool.func, '__doc__'):
                    tool_desc = str(tool.func.__doc__ or "").upper()
                
                tool_name_upper = str(tool_name).upper()
                
                # Identify tool source based on name and description patterns
                if any(keyword in tool_name_upper or keyword in tool_desc for keyword in 
                       ['TIME_SERIES', 'RSI', 'MACD', 'BBANDS', 'SMA', 'EMA', 'GDP', 'CPI', 
                        'INFLATION', 'ALPHA_VANTAGE', 'ALPHAVANTAGE', 'STOCK', 'QUOTE', 
                        'CURRENCY', 'CRYPTO', 'ECONOMIC', 'INDICATOR']):
                    tool_info.setdefault('alphavantage', []).append(str(tool_name))
                elif tool_name in ['add', 'multiply', 'subtract', 'divide'] or 'math' in tool_name_upper:
                    tool_info.setdefault('math', []).append(str(tool_name))
                elif tool_name in ['buy', 'sell'] or 'trade' in tool_name_upper:
                    tool_info.setdefault('trade', []).append(str(tool_name))
                else:
                    tool_info.setdefault('other', []).append(str(tool_name))
            
            # Print tool summary
            if tool_info:
                print("📋 Tools by source:")
                for source, tools in sorted(tool_info.items()):
                    tool_list = tools[:10]  # Show first 10 tools
                    print(f"   {source}: {len(tools)} tools")
                    if tool_list:
                        print(f"      Examples: {', '.join(tool_list)}{'...' if len(tools) > 10 else ''}")
            
            # Verify Alpha Vantage tools are loaded
            alpha_vantage_tools = tool_info.get('alphavantage', [])
            if alpha_vantage_tools:
                print(f"✅ Alpha Vantage MCP tools loaded: {len(alpha_vantage_tools)} tools")
            elif 'alphavantage' in self.mcp_config:
                print("⚠️  Warning: Alpha Vantage MCP configured but no tools detected")
                print("   This may indicate a connection issue. Check ALPHAADVANTAGE_API_KEY environment variable.")
            
            # Filter tools to reduce token usage - only keep CRITICAL tools
            # Alpha Vantage tool schemas are extremely large (~20k tokens each)
            # We must be very aggressive in filtering to stay under 131k token limit
            essential_tool_names = {
                # Trading tools (absolutely required)
                'buy', 'sell',
                # ONLY ONE price data tool (most essential)
                'TIME_SERIES_DAILY',
                # Math tools (essential for portfolio calculations)
                'add', 'multiply', 'subtract', 'divide'
            }
            
            original_tool_count = len(self.tools)
            filtered_tools = []
            
            for tool in self.tools:
                tool_name = None
                if hasattr(tool, 'name'):
                    tool_name = tool.name
                elif hasattr(tool, '__name__'):
                    tool_name = tool.__name__
                elif hasattr(tool, 'func') and hasattr(tool.func, '__name__'):
                    tool_name = tool.func.__name__
                
                # Use exact match instead of substring match to avoid false positives
                # Convert both to uppercase for case-insensitive comparison
                if tool_name:
                    tool_name_upper = str(tool_name).upper()
                    essential_names_upper = {name.upper() for name in essential_tool_names}
                    
                    # Check for exact match
                    if tool_name_upper in essential_names_upper:
                        filtered_tools.append(tool)
            
            if len(filtered_tools) > 0:
                self.tools = filtered_tools
                print(f"🔧 Filtered tools: {original_tool_count} → {len(self.tools)} (kept {len(self.tools)/original_tool_count*100:.0f}% essential tools)")
                print(f"   This reduces context usage and prevents token limit errors")
            else:
                print(f"⚠️  Warning: Tool filtering resulted in 0 tools, keeping all {original_tool_count} tools")
                print(f"   This may cause token limit issues. Consider using a model with larger context window.")
                
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
        
        # Bind tools to model
        if self.tools:
            print(f"🔗 Binding {len(self.tools)} tools to model")
            self.agent = self.model.bind_tools(self.tools)
        else:
            self.agent = self.model
        
        print(f"✅ Agent {self.signature} initialization completed")
    
    def _setup_logging(self, today_date: str) -> str:
        """Set up log file path"""
        # Use data_path directly as it already contains the full path
        log_path = os.path.join(self.data_path, 'log', today_date)
        if not os.path.exists(log_path):
            os.makedirs(log_path)
        return os.path.join(log_path, "log.jsonl")
    
    def _msg_to_dict(self, msg) -> Dict[str, Any]:
        """Convert BaseMessage to dictionary"""
        if isinstance(msg, dict):
            return msg
        if isinstance(msg, SystemMessage):
            return {"role": "system", "content": msg.content}
        elif isinstance(msg, HumanMessage):
            return {"role": "user", "content": msg.content}
        elif isinstance(msg, AIMessage):
            d = {"role": "assistant", "content": msg.content or ""}
            if msg.tool_calls:
                d["tool_calls"] = msg.tool_calls
            return d
        elif isinstance(msg, ToolMessage):
            return {"role": "tool", "content": msg.content, "tool_call_id": msg.tool_call_id, "name": msg.name}
        return {"role": "unknown", "content": str(msg)}

    def _log_message(self, log_file: str, new_messages: List[Any]) -> None:
        """Log messages to log file"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "signature": self.signature,
            "new_messages": [self._msg_to_dict(msg) for msg in new_messages]
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
    
    def _extract_tool_calls_info(self, response: Any) -> List[Dict[str, Any]]:
        """Extract detailed tool call information from agent response"""
        tool_calls_info = []
        
        def get_field(obj, key, default=None):
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)
        
        def get_nested(obj, path, default=None):
            current = obj
            for key in path:
                current = get_field(current, key, None)
                if current is None:
                    return default
            return current
        
        # Get messages from response
        messages = get_field(response, "messages", []) or []
        
        for msg in messages:
            # Check for tool calls in additional_kwargs
            additional_kwargs = get_field(msg, "additional_kwargs", {}) or {}
            tool_calls = get_field(additional_kwargs, "tool_calls", None)
            
            if tool_calls and isinstance(tool_calls, list):
                for tool_call in tool_calls:
                    tool_info = {
                        "tool_name": get_field(tool_call, "name", "unknown"),
                        "tool_call_id": get_field(tool_call, "id", "unknown"),
                        "arguments": get_field(tool_call, "args", {}),
                    }
                    tool_calls_info.append(tool_info)
            
            # Also check for tool_call_id in the message itself (tool response)
            tool_call_id = get_field(msg, "tool_call_id")
            tool_name = get_field(msg, "name")
            if tool_call_id or tool_name:
                # This is a tool response, we already logged the call above
                # But we can add execution info here if needed
                pass
        
        return tool_calls_info
    
    async def _ainvoke_with_retry(self, messages: List[Any]) -> Any:
        """Agent invocation with retry"""
        print(f"📤 [DEBUG] Starting _ainvoke_with_retry")
        print(f"   Message count: {len(messages)}")
        
        for attempt in range(1, self.max_retries + 1):
            try:
                print(f"📤 [DEBUG] Calling agent.ainvoke (Attempt {attempt}/{self.max_retries})...")
                
                # Add timeout to prevent infinite hanging (5 minutes)
                try:
                    result = await asyncio.wait_for(
                        self.agent.ainvoke(messages),
                        timeout=300  # 5 minutes timeout
                    )
                except asyncio.TimeoutError:
                    print(f"⏱️  [DEBUG] Agent.ainvoke timed out after 300 seconds")
                    if attempt < self.max_retries:
                        wait_time = self.base_delay * (2 ** (attempt - 1))
                        print(f"   Retrying in {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise TimeoutError("Agent call timed out after 300 seconds")
                
                print(f"✅ [DEBUG] Agent.ainvoke completed successfully")
                return result
            except Exception as e:
                error_msg = str(e)
                print(f"❌ [DEBUG] Exception in _ainvoke_with_retry (Attempt {attempt}/{self.max_retries}): {error_msg[:200]}")
                
                if attempt == self.max_retries:
                    raise e
                await asyncio.sleep(self.base_delay * attempt)
    
    def _truncate_message_content(self, content: str, max_length: int = 5000) -> str:
        """Truncate message content"""
        if len(content) <= max_length:
            return content
        return content[:max_length] + f"\n\n[Content truncated: {len(content)} chars -> {max_length} chars]"
    
    def _manage_message_history(self, messages: List[Any], max_messages: int = 20) -> List[Any]:
        """Manage message history"""
        if len(messages) <= max_messages:
            return messages
        
        # Keep SystemMessage + First User Message + Last (N-2) messages
        truncated = []
        if messages and isinstance(messages[0], SystemMessage):
            truncated.append(messages[0])
            start_idx = 1
        else:
            start_idx = 0
            
        if len(messages) > start_idx:
            truncated.append(messages[start_idx]) # Keep first user message/context
            
        remaining_slots = max_messages - len(truncated)
        if remaining_slots > 0:
            truncated.extend(messages[-remaining_slots:])
            
        print(f"⚠️  Message history truncated: {len(messages)} -> {len(truncated)} messages")
        return truncated
    
    async def run_trading_session(self, today_date: str) -> None:
        """Run single day trading session"""
        print(f"📈 Starting trading session: {today_date}")
        log_file = self._setup_logging(today_date)
        
        # 1. Prepare initial messages
        system_prompt = get_agent_system_prompt(today_date, self.signature)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Please analyze and update today's ({today_date}) positions.")
        ]
        
        self._log_message(log_file, messages)
        
        # Create tool map for execution
        tool_map = {t.name: t for t in self.tools} if self.tools else {}
        
        current_step = 0
        while current_step < self.max_steps:
            current_step += 1
            print(f"🔄 Step {current_step}/{self.max_steps}")
            
            try:
                # 2. Call LLM
                response = await self._ainvoke_with_retry(messages)
                messages.append(response)
                self._log_message(log_file, [response])
                
                # 3. Handle Tool Calls
                if response.tool_calls:
                    print(f"🛠️  Processing {len(response.tool_calls)} tool calls")
                    for tool_call in response.tool_calls:
                        tool_name = tool_call["name"]
                        tool_args = tool_call["args"]
                        tool_id = tool_call["id"]
                        
                        tool_output = "Error: Tool not found"
                        if tool_name in tool_map:
                            try:
                                print(f"📞 Executing tool: {tool_name}")
                                tool_output = tool_map[tool_name].invoke(tool_args)
                            except Exception as e:
                                tool_output = f"Error executing {tool_name}: {e}"
                        
                        # Truncate output
                        tool_output = self._truncate_message_content(str(tool_output))
                        
                        # Create ToolMessage
                        tool_msg = ToolMessage(
                            content=tool_output,
                            tool_call_id=tool_id,
                            name=tool_name
                        )
                        messages.append(tool_msg)
                        self._log_message(log_file, [tool_msg])
                    
                    # Continue to next iteration (LLM will see tool outputs)
                    continue
                
                # 4. No tool calls -> Final Answer
                content = response.content
                print(f"✅ Agent Response: {content[:200]}...")
                
                if STOP_SIGNAL in content:
                    print("✅ Received stop signal")
                    break
                
                # If no stop signal but no tool calls, maybe just chatting or finished
                # We can prompt it to finish if it seems done
                if "analysis" in content.lower() and "recommendation" in content.lower():
                     # Maybe force stop or let it continue if max_steps not reached
                     pass
                     
            except Exception as e:
                print(f"❌ Error in trading loop: {e}")
                import traceback
                traceback.print_exc()
                raise
                
            # Manage history size
            messages = self._manage_message_history(messages)
        
        # Handle results
        print(f"📊 Handling trading results for {today_date}...")
        await self._handle_trading_result(today_date)
    
    async def _handle_trading_result(self, today_date: str) -> None:
        """Handle trading results"""
        if_trade = get_config_value("IF_TRADE")
        if if_trade:
            write_config_value("IF_TRADE", False)
            print("✅ Trading completed")
        else:
            # No trading occurred, but we still need to record the position for this date
            # Check if a position record already exists for today
            position_file = self.position_file
            has_record_for_today = False
            
            if os.path.exists(position_file):
                try:
                    with open(position_file, 'r', encoding='utf-8') as f:
                        lines = [line for line in f if line.strip()]
                        if lines:
                            last_record = json.loads(lines[-1])
                            if last_record.get("date") == today_date:
                                has_record_for_today = True
                                print("📊 Position record already exists for today")
                except Exception as e:
                    print(f"⚠️  Error reading position file: {e}")
            
            if not has_record_for_today:
                # No record for today, add no_trade record
                print("📊 No trading, maintaining positions")
                try:
                    add_no_trade_record(today_date, self.signature)
                except Exception as e:
                    print(f"❌ Failed to add no_trade record: {e}")
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
        Always creates a new initial position for each backtest, even if one exists.
        
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
        # If exists, we'll still create a new one (for fresh backtest start)
        position_exists = False
        if os.path.exists(self.position_file):
            with open(self.position_file, "r") as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        doc = json.loads(line)
                        if doc.get("date") == position_date and doc.get("id") == 0:
                            position_exists = True
                            break
                    except:
                        continue
        
        if position_exists:
            print(f"ℹ️  Initial position for {position_date} already exists, but creating fresh one for this backtest")
        
        # Always append to existing file or create new file
        # This ensures each backtest starts with a fresh initial position
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
            
            # Always create initial position for this backtest date range (even if file exists)
            # This ensures each backtest starts with a fresh initial position
            print(f"📅 Creating initial position for backtest start date {init_date}...")
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
        print(f"🔄 [DEBUG] Starting run_with_retry for {today_date}")
        for attempt in range(1, self.max_retries + 1):
            try:
                print(f"🔄 [DEBUG] Attempting to run {self.signature} - {today_date} (Attempt {attempt}/{self.max_retries})")
                await self.run_trading_session(today_date)
                print(f"✅ [DEBUG] {self.signature} - {today_date} run successful")
                return
            except Exception as e:
                error_type = type(e).__name__
                error_msg = str(e)
                print(f"❌ [DEBUG] Attempt {attempt} failed:")
                print(f"   Error Type: {error_type}")
                print(f"   Error Message: {error_msg[:500]}")
                import traceback
                print(f"   Traceback:")
                traceback.print_exc()
                
                if attempt == self.max_retries:
                    print(f"💥 [DEBUG] {self.signature} - {today_date} all {self.max_retries} retries failed")
                    raise
                else:
                    wait_time = self.base_delay * attempt
                    print(f"⏳ [DEBUG] Waiting {wait_time} seconds before retry...")
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
        for idx, date in enumerate(trading_dates, 1):
            print(f"🔄 Processing {self.signature} - Date: {date} ({idx}/{len(trading_dates)})")
            
            # Set configuration
            print(f"📝 [DEBUG] Setting configuration for date {date}...")
            write_config_value("TODAY_DATE", date)
            write_config_value("SIGNATURE", self.signature)
            print(f"✅ [DEBUG] Configuration set")
            
            try:
                print(f"🚀 [DEBUG] Starting run_with_retry for {date}...")
                await self.run_with_retry(date)
                print(f"✅ [DEBUG] run_with_retry completed for {date}")
            except Exception as e:
                print(f"❌ [DEBUG] Error processing {self.signature} - Date: {date}")
                print(f"   Error Type: {type(e).__name__}")
                print(f"   Error Message: {str(e)[:500]}")
                import traceback
                print(f"   Full traceback:")
                traceback.print_exc()
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
