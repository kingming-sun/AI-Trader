"""
基于 ReAct 模式的智能股票分析服务
完全替代 langgraph_service，使用 LangChain Agent Executor
"""
import os
import re
import json
import asyncio
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import structlog

HAS_LC_AGENT = True
try:
    from langchain.agents import AgentExecutor, create_openai_tools_agent
except Exception:
    HAS_LC_AGENT = False
    AgentExecutor = None
    create_openai_tools_agent = None
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, BaseMessage
try:
    from langchain_core.tools import tool
except Exception:
    try:
        from langchain.tools import tool
    except Exception:
        def tool(func):
            return func
from dotenv import load_dotenv

# 加载环境变量（同时尝试项目根与 backend/.env）
load_dotenv()
try:
    load_dotenv(Path(__file__).parent / ".env")
except Exception:
    pass

# 配置日志
logger = structlog.get_logger()


# ==================== 配置管理 ====================
class AgentConfig:
    """Agent 配置"""
    
    # API Keys
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    ALPHA_VANTAGE_API_KEY = os.getenv("ALPHAVANTAGE_API_KEY") or os.getenv("ALPHA_VANTAGE_API_KEY") or os.getenv("ALPHAADVANTAGE_API_KEY")
    
    # OpenAI 配置
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")
    OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0"))
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
    
    # Alpha Vantage 配置
    ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
    
    # 日志目录
    BASE_DIR = Path(__file__).parent
    LOGS_DIR = BASE_DIR / "logs" / "conversations"
    
    @classmethod
    def validate(cls):
        """验证配置"""
        if not cls.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY 未设置")
        if not cls.ALPHA_VANTAGE_API_KEY:
            raise ValueError("ALPHA_VANTAGE_API_KEY 未设置")
        
        # 创建日志目录
        cls.LOGS_DIR.mkdir(parents=True, exist_ok=True)
        
        logger.info("配置验证通过", 
                   model=cls.OPENAI_MODEL, 
                   logs_dir=str(cls.LOGS_DIR))


# ==================== Alpha Vantage 工具集 ====================
class AlphaVantageClient:
    """Alpha Vantage API 客户端"""
    
    def __init__(self):
        self.base_url = AgentConfig.ALPHA_VANTAGE_BASE_URL
        self.api_key = AgentConfig.ALPHA_VANTAGE_API_KEY
        
        # 本地数据支持
        self.data_dir = Path(__file__).parent.parent.parent / "data"
        self.local_cache = {}
        
    def _load_local_data(self, symbol: str) -> Optional[Dict]:
        """尝试加载本地数据"""
        symbol = symbol.upper()
        if symbol in self.local_cache:
            return self.local_cache[symbol]
            
        # 1. 尝试 daily_prices_{symbol}.json
        daily_file = self.data_dir / f"daily_prices_{symbol}.json"
        if daily_file.exists():
            try:
                with open(daily_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.local_cache[symbol] = data
                    return data
            except:
                pass
                
        # 2. 尝试从 merged.jsonl 提取 (较慢，暂只支持 daily_prices)
        return None
    
    def _request(self, params: Dict) -> Dict:
        """通用请求方法 (支持本地回退)"""
        symbol = params.get("symbol") or params.get("tickers")
        function = params.get("function")
        
        # 尝试本地回退 (仅支持 TIME_SERIES_DAILY 和 GLOBAL_QUOTE)
        if symbol and function in ["TIME_SERIES_DAILY", "GLOBAL_QUOTE"]:
            local_data = self._load_local_data(symbol)
            if local_data:
                if function == "TIME_SERIES_DAILY":
                    # 直接返回本地历史数据
                    return local_data
                elif function == "GLOBAL_QUOTE":
                    # 从历史数据构造最新 Quote
                    ts = local_data.get("Time Series (Daily)", {})
                    if ts:
                        latest_date = sorted(ts.keys())[-1]
                        latest = ts[latest_date]
                        # 构造 Quote 格式
                        return {
                            "Global Quote": {
                                "01. symbol": symbol,
                                "02. open": latest.get("1. open", "0"),
                                "03. high": latest.get("2. high", "0"),
                                "04. low": latest.get("3. low", "0"),
                                "05. price": latest.get("4. close", "0"),
                                "06. volume": latest.get("5. volume", "0"),
                                "07. latest trading day": latest_date,
                                "08. previous close": latest.get("4. close", "0"), # 简化
                                "09. change": "0.00",
                                "10. change percent": "0.00%"
                            }
                        }

        # 如果没有本地数据或不是支持的函数，调用 API
        params["apikey"] = self.api_key
        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # 检查API错误
            if "Error Message" in data:
                return {"error": data["Error Message"]}
            if "Note" in data:
                return {"error": "API调用频率超限，请稍后重试"}
            
            return data
        except Exception as e:
            return {"error": f"请求失败: {str(e)}"}


# 全局客户端实例
av_client = AlphaVantageClient()


@tool
def get_stock_price(symbol: str) -> str:
    """
    获取股票的实时价格和基本信息
    
    参数:
        symbol: 股票代码，如 'AAPL', 'TSLA', 'MSFT'
    
    返回:
        包含当前价格、涨跌幅、成交量等信息的字符串
    """
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": symbol.upper()
    }
    
    data = av_client._request(params)
    
    if "error" in data:
        return f"错误: {data['error']}"
    
    quote = data.get("Global Quote", {})
    if not quote:
        return f"未找到股票 {symbol} 的数据"
    
    result = f"""
📊 {symbol.upper()} 实时行情：
- 当前价格: ${quote.get('05. price', 'N/A')}
- 涨跌幅: {quote.get('10. change percent', 'N/A')}
- 涨跌额: ${quote.get('09. change', 'N/A')}
- 开盘价: ${quote.get('02. open', 'N/A')}
- 最高价: ${quote.get('03. high', 'N/A')}
- 最低价: ${quote.get('04. low', 'N/A')}
- 成交量: {quote.get('06. volume', 'N/A')}
- 最新交易日: {quote.get('07. latest trading day', 'N/A')}
"""
    return result.strip()


@tool
def get_news(symbol: str, limit: int = 5) -> str:
    """
    获取股票相关的最新新闻和情感分析
    
    参数:
        symbol: 股票代码
        limit: 返回新闻数量，默认5条
    
    返回:
        新闻列表和整体情感评分
    """
    params = {
        "function": "NEWS_SENTIMENT",
        "tickers": symbol.upper(),
        "limit": limit
    }
    
    data = av_client._request(params)
    
    if "error" in data:
        return f"错误: {data['error']}"
    
    feed = data.get("feed", [])
    if not feed:
        return f"未找到股票 {symbol} 的相关新闻"
    
    # 计算平均情感分数
    sentiment_scores = []
    news_list = []
    
    for idx, item in enumerate(feed[:limit], 1):
        title = item.get("title", "无标题")
        time = item.get("time_published", "")
        summary = item.get("summary", "")[:100]  # 截取前100字符
        
        # 获取该股票的情感分数
        ticker_sentiment = None
        for ts in item.get("ticker_sentiment", []):
            if ts.get("ticker", "").upper() == symbol.upper():
                ticker_sentiment = ts
                break
        
        if ticker_sentiment:
            score = float(ticker_sentiment.get("ticker_sentiment_score", 0))
            sentiment_scores.append(score)
            label = ticker_sentiment.get("ticker_sentiment_label", "中性")
            
            news_list.append(f"{idx}. 【{label}】{title}\n   时间: {time}\n   摘要: {summary}...")
        else:
            news_list.append(f"{idx}. {title}\n   时间: {time}\n   摘要: {summary}...")
    
    # 计算平均情感
    avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
    sentiment_label = "正面" if avg_sentiment > 0.15 else "负面" if avg_sentiment < -0.15 else "中性"
    
    result = f"""
📰 {symbol.upper()} 最新新闻（共{len(feed)}条）：

整体情感: {sentiment_label} (评分: {avg_sentiment:.3f})

{chr(10).join(news_list)}
"""
    return result.strip()


@tool
def calculate_indicators(symbol: str) -> str:
    """
    计算股票的关键技术指标
    
    参数:
        symbol: 股票代码
    
    返回:
        包含RSI、MACD、移动平均线等技术指标
    """
    # 获取RSI
    rsi_params = {
        "function": "RSI",
        "symbol": symbol.upper(),
        "interval": "daily",
        "time_period": 14,
        "series_type": "close"
    }
    rsi_data = av_client._request(rsi_params)
    
    # 获取MACD
    macd_params = {
        "function": "MACD",
        "symbol": symbol.upper(),
        "interval": "daily",
        "series_type": "close"
    }
    macd_data = av_client._request(macd_params)
    
    # 获取SMA (简单移动平均线)
    sma_params = {
        "function": "SMA",
        "symbol": symbol.upper(),
        "interval": "daily",
        "time_period": 50,
        "series_type": "close"
    }
    sma_data = av_client._request(sma_params)
    
    result_parts = [f"📈 {symbol.upper()} 技术指标分析：\n"]
    
    # 解析RSI
    if "Technical Analysis: RSI" in rsi_data:
        rsi_values = rsi_data["Technical Analysis: RSI"]
        latest_date = list(rsi_values.keys())[0]
        rsi_value = float(rsi_values[latest_date]["RSI"])
        
        rsi_status = "超买" if rsi_value > 70 else "超卖" if rsi_value < 30 else "正常"
        result_parts.append(f"- RSI(14): {rsi_value:.2f} ({rsi_status})")
    
    # 解析MACD
    if "Technical Analysis: MACD" in macd_data:
        macd_values = macd_data["Technical Analysis: MACD"]
        latest_date = list(macd_values.keys())[0]
        macd = float(macd_values[latest_date]["MACD"])
        signal = float(macd_values[latest_date]["MACD_Signal"])
        hist = float(macd_values[latest_date]["MACD_Hist"])
        
        macd_status = "金叉(看涨)" if hist > 0 else "死叉(看跌)"
        result_parts.append(f"- MACD: {macd:.4f}, Signal: {signal:.4f}, Hist: {hist:.4f} ({macd_status})")
    
    # 解析SMA
    if "Technical Analysis: SMA" in sma_data:
        sma_values = sma_data["Technical Analysis: SMA"]
        latest_date = list(sma_values.keys())[0]
        sma_value = float(sma_values[latest_date]["SMA"])
        result_parts.append(f"- SMA(50): ${sma_value:.2f}")
    
    if len(result_parts) == 1:
        return f"无法获取 {symbol} 的技术指标数据"
    
    return "\n".join(result_parts)


@tool
def get_company_info(symbol: str) -> str:
    """
    获取公司基本面信息
    
    参数:
        symbol: 股票代码
    
    返回:
        公司名称、行业、市值、PE比率等基本信息
    """
    params = {
        "function": "OVERVIEW",
        "symbol": symbol.upper()
    }
    
    data = av_client._request(params)
    
    if "error" in data:
        return f"错误: {data['error']}"
    
    if not data or "Symbol" not in data:
        return f"未找到股票 {symbol} 的公司信息"
    
    result = f"""
🏢 {data.get('Name', 'N/A')} ({symbol.upper()})

基本信息:
- 行业: {data.get('Industry', 'N/A')}
- 板块: {data.get('Sector', 'N/A')}
- 国家: {data.get('Country', 'N/A')}
- 交易所: {data.get('Exchange', 'N/A')}

财务指标:
- 市值: ${data.get('MarketCapitalization', 'N/A')}
- PE比率: {data.get('PERatio', 'N/A')}
- PB比率: {data.get('PriceToBookRatio', 'N/A')}
- 股息率: {data.get('DividendYield', 'N/A')}
- EPS: ${data.get('EPS', 'N/A')}
- 52周最高: ${data.get('52WeekHigh', 'N/A')}
- 52周最低: ${data.get('52WeekLow', 'N/A')}

公司简介:
{data.get('Description', 'N/A')[:200]}...
"""
    return result.strip()


def get_all_tools():
    """返回所有可用工具"""
    return [
        get_stock_price,
        get_news,
        calculate_indicators,
        get_company_info
    ]


# ==================== 结果解析器 ====================
class ResultParser:
    """智能解析 Agent 输出，提取结构化信息"""
    
    def parse(self, agent_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        从 Agent 的自然语言输出中解析出结构化信息
        
        参数:
            agent_result: Agent 返回的原始结果
        
        返回:
            包含 recommendation, confidence_score, key_metrics 的字典
        """
        final_answer = agent_result.get("final_answer", "")
        tools_used = agent_result.get("tools_used", [])
        steps = agent_result.get("steps", [])
        
        # 1. 解析建议 (recommendation)
        recommendation = self._parse_recommendation(final_answer)
        
        # 2. 解析置信度 (confidence_score)
        confidence_score = self._parse_confidence(final_answer)
        
        # 3. 从工具输出中提取关键指标
        key_metrics = self._extract_key_metrics(steps)
        
        return {
            "recommendation": recommendation,
            "confidence_score": confidence_score,
            "key_metrics": key_metrics
        }
    
    def _parse_recommendation(self, text: str) -> str:
        """解析投资建议"""
        text_lower = text.lower()
        
        # 关键词匹配
        buy_keywords = ['买入', 'buy', '建议购买', '可以买', '适合买入', '建立仓位', '增持']
        sell_keywords = ['卖出', 'sell', '建议卖出', '减仓', '止盈', '离场', '抛售']
        hold_keywords = ['持有', 'hold', '观望', '等待', '维持', '保持']
        
        # 优先级：SELL > BUY > HOLD
        for keyword in sell_keywords:
            if keyword in text_lower:
                return "SELL"
        
        for keyword in buy_keywords:
            if keyword in text_lower:
                return "BUY"
        
        for keyword in hold_keywords:
            if keyword in text_lower:
                return "HOLD"
        
        # 默认返回 HOLD
        return "HOLD"
    
    def _parse_confidence(self, text: str) -> float:
        """解析置信度"""
        # 尝试从文本中提取百分比
        confidence_patterns = [
            r'置信度[：:]\s*(\d+(?:\.\d+)?)\s*%',
            r'confidence[：:]\s*(\d+(?:\.\d+)?)\s*%',
            r'(\d+(?:\.\d+)?)\s*%\s*置信度',
            r'(\d+(?:\.\d+)?)\s*%\s*confidence',
        ]
        
        for pattern in confidence_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                confidence = float(match.group(1))
                return min(confidence / 100.0, 1.0)  # 转换为 0-1 范围
        
        # 基于关键词推断置信度
        text_lower = text.lower()
        if any(word in text_lower for word in ['强烈', '非常', 'strongly', 'highly']):
            return 0.85
        elif any(word in text_lower for word in ['建议', 'recommend', '应该']):
            return 0.75
        elif any(word in text_lower for word in ['可能', 'may', 'might', '或许']):
            return 0.60
        
        # 默认置信度
        return 0.70
    
    def _extract_key_metrics(self, steps: List[Dict]) -> Dict[str, Any]:
        """从工具调用步骤中提取关键指标"""
        metrics = {
            "trend": "unknown",
            "rsi": None,
            "sentiment": "neutral",
            "has_position": False
        }
        
        for step in steps:
            tool_output = step.get("output", "")
            
            # 提取 RSI
            rsi_match = re.search(r'RSI\(14\):\s*(\d+(?:\.\d+)?)', tool_output)
            if rsi_match:
                metrics["rsi"] = float(rsi_match.group(1))
            
            # 提取趋势
            if "金叉" in tool_output or "看涨" in tool_output:
                metrics["trend"] = "bullish"
            elif "死叉" in tool_output or "看跌" in tool_output:
                metrics["trend"] = "bearish"
            
            # 提取情感
            if "整体情感: 正面" in tool_output:
                metrics["sentiment"] = "positive"
            elif "整体情感: 负面" in tool_output:
                metrics["sentiment"] = "negative"
        
        return metrics


# ==================== 主服务类 ====================
class StockAnalysisAgent:
    """基于 ReAct 模式的智能股票分析 Agent"""
    
    def __init__(self):
        """初始化 Agent"""
        # 验证配置
        AgentConfig.validate()
        
        # 初始化 LLM
        self.llm = ChatOpenAI(
            model=AgentConfig.OPENAI_MODEL,
            temperature=AgentConfig.OPENAI_TEMPERATURE,
            api_key=AgentConfig.OPENAI_API_KEY,
            base_url=AgentConfig.OPENAI_BASE_URL
        )
        
        # 获取工具
        self.tools = get_all_tools()
        
        # 根据可用性选择执行方式
        # 统一改为原生 Tool Calling 执行（兼容 1.x）
        self.prompt = None
        self.agent = None
        self.executor = None
        self.llm_with_tools = self.llm.bind_tools(self.tools)
        logger.info("Tool Calling 模式初始化完成", model=AgentConfig.OPENAI_MODEL, tools_count=len(self.tools))
        
        # 创建解析器
        self.parser = ResultParser()
        self.histories: Dict[str, List[BaseMessage]] = {}
    
    def _create_prompt(self):
        """"""
        system_message = """你是一位专业的股票分析师，擅长综合分析股票的消息面、技术面和基本面。

你的任务是：
1. 使用提供的工具获取股票的各类数据
2. 从消息面、技术面、基本面三个维度进行分析
3. 给出明确的投资建议：买入/持有/卖出
4. 提供详细的分析理由和风险提示

工具使用策略：
- get_stock_price: 获取实时价格和基本行情
- get_news: 分析最近新闻和市场情感
- calculate_indicators: 计算技术指标（RSI、MACD等）
- get_company_info: 获取公司基本面信息

分析框架：
1. 消息面：新闻情感、重大事件、市场热度
2. 技术面：价格趋势、技术指标、支撑压力位
3. 基本面：公司质量、估值水平、财务健康度
4. 综合决策：基于以上三个维度给出建议

**重要：你的最终回答必须包含以下结构化信息**：
- 明确的建议：买入/持有/卖出
- 置信度：X% (0-100之间的数字)
- 详细的分析理由

请用中文回答，分析要专业且易懂。"""
        
        return None
    
    def _build_query(
        self, 
        symbol: str, 
        analysis_type: str, 
        portfolio: Optional[Dict[str, Any]]
    ) -> str:
        """构建输入查询"""
        base_query = f"""请全面分析股票 {symbol.upper()}，包括：
1. 消息面分析（最近新闻和市场情感）
2. 技术面分析（价格趋势和技术指标）
3. 基本面分析（公司质量和估值）
4. 最终给出买入/持有/卖出的明确建议，并说明理由和置信度"""
        
        # 如果有持仓信息，添加到查询中
        if portfolio and portfolio.get("positions"):
            symbol_position = portfolio["positions"].get(symbol, {})
            if symbol_position:
                shares = symbol_position.get("shares", 0)
                avg_cost = symbol_position.get("avg_cost", 0)
                total_value = portfolio.get("total_value", 0)
                
                portfolio_info = f"""

**用户持仓信息**：
- 持有 {symbol} 股票：{shares} 股
- 平均成本：${avg_cost:.2f}
- 投资组合总价值：${total_value:.2f}

请在分析时考虑用户的持仓情况，给出是否应该加仓、减仓或持有的建议。"""
                
                base_query += portfolio_info
        
        return base_query
    
    async def analyze_stock(
        self, 
        symbol: str, 
        analysis_type: str = "comprehensive", 
        portfolio: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        执行股票分析（异步方法，保持和 langgraph_service 相同的接口）
        
        参数:
            symbol: 股票代码
            analysis_type: 分析类型（暂时未使用，为了接口兼容）
            portfolio: 用户持仓信息
        
        返回:
            包含 recommendation, confidence_score, summary, key_metrics 等的字典
        """
        logger.info("开始股票分析", symbol=symbol, analysis_type=analysis_type)
        
        try:
            # 1. 构建查询
            input_query = self._build_query(symbol, analysis_type, portfolio)
            
            # 2. 原生 Tool Calling 循环执行（分析不依赖历史，但会在结束后写入历史）
            messages = [HumanMessage(content=input_query)]
            intermediate_steps = []
            debug_news = None
            tools_map = {t.name if hasattr(t, 'name') else t.__name__: t for t in self.tools}
            for _ in range(6):
                ai: AIMessage = await asyncio.to_thread(self.llm_with_tools.invoke, messages)
                tool_calls = getattr(ai, "tool_calls", None)
                if not tool_calls:
                    final_answer = ai.content
                    break
                messages.append(ai)
                for call in tool_calls:
                    name = call.get("name")
                    args = call.get("args", {})
                    call_id = call.get("id")
                    tool_obj = tools_map.get(name)
                    output = self._safe_call_tool(tool_obj, **args) if tool_obj else f"未知工具: {name}"
                    intermediate_steps.append({"tool": name or "unknown", "input": args, "output": output})
                    if name == "get_news":
                        try:
                            tick = (args.get("symbol") or symbol).upper()
                            data = av_client._request({"function": "NEWS_SENTIMENT", "tickers": tick, "limit": 5})
                            debug_news = {"news_items": data.get("feed", [])}
                        except Exception:
                            pass
                    messages.append(ToolMessage(content=output, tool_call_id=call_id))
            else:
                final_answer = ai.content

            # 4. 格式化步骤
            formatted_steps = self._format_steps(intermediate_steps)
            tools_used = [s.get("tool", "unknown") for s in intermediate_steps]
            
            # 5. 构建原始结果
            agent_result = {
                "symbol": symbol.upper(),
                "timestamp": datetime.now().isoformat(),
                "final_answer": final_answer,
                "steps": formatted_steps,
                "tools_used": tools_used,
                **({"news_data": debug_news} if debug_news else {})
            }
            
            # 6. 智能解析结果
            parsed = self.parser.parse(agent_result)

            # 7. 保存对话历史
            self._save_conversation(agent_result)
            self._update_history(symbol, messages + [AIMessage(content=final_answer)])
            
            # 8. 返回兼容 langgraph_service 的格式
            response = {
                "symbol": symbol.upper(),
                "analysis_type": analysis_type,
                "recommendation": parsed["recommendation"],
                "confidence_score": parsed["confidence_score"],
                "summary": final_answer,
                "key_metrics": parsed["key_metrics"],
                "detailed_analysis": agent_result,
                "messages": [step.get("output", "") for step in formatted_steps],
                "timestamp": agent_result["timestamp"]
            }
            
            logger.info("股票分析完成", 
                       symbol=symbol,
                       recommendation=parsed["recommendation"],
                       confidence=parsed["confidence_score"])
            
            return response
            
        except Exception as e:
            error_msg = f"分析失败: {str(e)}"
            logger.error("股票分析失败", symbol=symbol, error=str(e))
            
            return {
                "symbol": symbol.upper(),
                "analysis_type": analysis_type,
                "error": error_msg,
                "timestamp": datetime.now().isoformat()
            }
    
    def _format_steps(self, steps: List) -> List[Dict]:
        """格式化中间步骤"""
        formatted = []
        if steps and isinstance(steps[0], tuple):
            for idx, (action, observation) in enumerate(steps, 1):
                formatted.append({
                    "step": idx,
                    "tool": getattr(action, "tool", "unknown"),
                    "input": getattr(action, "tool_input", None),
                    "output": str(observation)[:500]
                })
        else:
            for idx, s in enumerate(steps, 1):
                formatted.append({
                    "step": idx,
                    "tool": s.get("tool", "unknown"),
                    "input": None,
                    "output": str(s.get("output", ""))[:500]
                })
        return formatted
    
    def _save_conversation(self, result: Dict[str, Any]):
        """保存对话历史到本地 JSON 文件"""
        try:
            # 生成文件名：symbol_YYYYMMDD_HHMMSS.json
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{result['symbol']}_{timestamp}.json"
            filepath = AgentConfig.LOGS_DIR / filename
            
            # 保存为 JSON
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=4, ensure_ascii=False)
            
            logger.info("对话历史已保存", filepath=str(filepath))
            
        except Exception as e:
            logger.warning("保存对话历史失败", error=str(e))

    def _update_history(self, symbol: str, new_messages: List[BaseMessage]):
        try:
            prev = self.histories.get(symbol.upper(), [])
            merged = prev + new_messages
            # 历史长度控制，避免无限增长
            self.histories[symbol.upper()] = merged[-50:]
        except Exception:
            pass

    def _safe_call_tool(self, tool_obj, **kwargs) -> str:
        """兼容调用 LangChain StructuredTool 或普通函数"""
        try:
            if hasattr(tool_obj, "invoke"):
                return tool_obj.invoke(kwargs)
            if hasattr(tool_obj, "run"):
                return tool_obj.run(kwargs)
            if callable(tool_obj):
                return tool_obj(**kwargs)
            return str(tool_obj)
        except Exception as e:
            return f"工具调用失败: {e}"

    async def answer_question(self, symbol: str, question: str, portfolio: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            base = f"请基于{symbol.upper()}的消息面、技术面和基本面，回答：{question}。需要时可调用工具获取数据。"
            if portfolio and portfolio.get("positions"):
                pos = portfolio["positions"].get(symbol, {})
                if pos:
                    base += f" 用户持仓：{pos.get('shares', 0)}股，成本价${pos.get('avg_cost', 0)}。"
            history = list(self.histories.get(symbol.upper(), []))
            messages = history + [HumanMessage(content=base)]
            steps = []
            tools_map = {t.name if hasattr(t, 'name') else t.__name__: t for t in self.tools}
            for _ in range(6):
                ai: AIMessage = await asyncio.to_thread(self.llm_with_tools.invoke, messages)
                tool_calls = getattr(ai, "tool_calls", None)
                if not tool_calls:
                    final = ai.content
                    break
                messages.append(ai)
                for call in tool_calls:
                    name = call.get("name")
                    args = call.get("args", {})
                    call_id = call.get("id")
                    tool_obj = tools_map.get(name)
                    output = self._safe_call_tool(tool_obj, **args) if tool_obj else f"未知工具: {name}"
                    steps.append({"tool": name or "unknown", "input": args, "output": output})
                    messages.append(ToolMessage(content=output, tool_call_id=call_id))
            else:
                final = ai.content
            self._update_history(symbol, [HumanMessage(content=base), AIMessage(content=final)])
            return {"content": final, "steps": steps, "timestamp": datetime.now().isoformat()}
        except Exception as e:
            return {"error": f"对话失败: {e}", "timestamp": datetime.now().isoformat()}


# ==================== 全局实例 ====================
# 创建全局 Agent 实例（单例模式）
stock_analysis_agent = StockAnalysisAgent()
